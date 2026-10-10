"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ScanLine, Volume2, VolumeX, X } from "lucide-react";

type Feedback = { ready: boolean; message: string; landmarks: number[][] };
const EDGES = [[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
function beep() {
  const audio=new AudioContext(), oscillator=audio.createOscillator(), gain=audio.createGain();
  oscillator.frequency.value=720; gain.gain.setValueAtTime(.12,audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.15);
  oscillator.connect(gain);gain.connect(audio.destination);
  oscillator.onended=()=>{void audio.close();};oscillator.start();oscillator.stop(audio.currentTime+.15);
}
export default function GuidedCamera({side,onCapture,onClose}:{side:boolean;onCapture:(file:File)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null), video=useRef<HTMLVideoElement>(null);
  const alive=useRef(true), taking=useRef(false), manualTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const soundRef=useRef(false), captureRef=useRef<()=>void>(()=>{});
  const [ready,setReady]=useState(false), [aiEnabled,setAiEnabled]=useState(false), [sound,setSound]=useState(false);
  const [error,setError]=useState(""), [count,setCount]=useState<number|null>(null);
  const [feedback,setFeedback]=useState<Feedback>({ready:false,message:"Bật AI để kiểm tra toàn thân và góc chụp.",landmarks:[]});
  const [dimensions,setDimensions]=useState({w:1080,h:1440});
  useEffect(()=>{
    alive.current=true;dialog.current?.showModal();let media:MediaStream|undefined;let cancelled=false;
    (async()=>{try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera cần localhost hoặc HTTPS.");
      media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1080},height:{ideal:1440}},audio:false});
      if(cancelled||!alive.current){media.getTracks().forEach(t=>t.stop());return;}
      if(video.current){video.current.srcObject=media;await video.current.play();}
      if(!cancelled&&alive.current&&video.current){setDimensions({w:video.current.videoWidth,h:video.current.videoHeight});setReady(true);}
    }catch(e){if(!cancelled&&alive.current)setError(e instanceof Error?e.message:"Không mở được camera. Hãy cho phép truy cập hoặc tải ảnh.");}})();
    return()=>{cancelled=true;alive.current=false;media?.getTracks().forEach(t=>t.stop());if(manualTimer.current)clearInterval(manualTimer.current);};
  },[]);
  captureRef.current=()=>{
    const el=video.current;if(!alive.current||taking.current||!el?.videoWidth)return;taking.current=true;
    const canvas=document.createElement("canvas");canvas.width=el.videoWidth;canvas.height=el.videoHeight;
    canvas.getContext("2d")?.drawImage(el,0,0);
    canvas.toBlob(blob=>{
      if(!alive.current)return;
      if(!blob){taking.current=false;setCount(null);setError("Không chụp được ảnh. Hãy thử lại.");return;}
      if(soundRef.current){try{beep();}catch{}}
      onCapture(new File([blob],side?"side.jpg":"front.jpg",{type:"image/jpeg"}));onClose();
    },"image/jpeg",.92);
  };
  useEffect(()=>{
    if(!ready||!aiEnabled)return;
    let stopped=false, previous:number[][]|null=null, goodFrames=0, deadline=0;
    let next:ReturnType<typeof setTimeout>, abort:AbortController|undefined;
    const canvas=document.createElement("canvas");
    async function check(){
      const el=video.current;if(stopped||!el||taking.current)return;
      try{
        const scale=Math.min(1,720/Math.max(el.videoWidth,el.videoHeight));
        canvas.width=Math.round(el.videoWidth*scale);canvas.height=Math.round(el.videoHeight*scale);
        canvas.getContext("2d")?.drawImage(el,0,0,canvas.width,canvas.height);
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.8));
        if(!blob||stopped)return;
        const body=new FormData();body.set("photo",blob,"frame.jpg");body.set("view",side?"side":"front");body.set("consent","true");
        abort=new AbortController();const timeout=setTimeout(()=>abort?.abort(),5000);let response:Response;
        try{response=await fetch("/api/capture-check",{method:"POST",body,signal:abort.signal});}finally{clearTimeout(timeout);}
        const data=await response.json();if(stopped)return;
        if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Chưa kết nối được hướng dẫn AI.");
        const result=data as Feedback;setFeedback(result);setError("");
        const visible=[11,12,23,24,25,26,27,28].filter(i=>result.landmarks[i]?.[2]>.55&&(previous?.[i]?.[2]||0)>.55);
        const motion=previous&&visible.length>=4?visible.reduce((n,i)=>n+Math.hypot(result.landmarks[i][0]-previous![i][0],result.landmarks[i][1]-previous![i][1]),0)/visible.length:Infinity;
        previous=result.ready?result.landmarks:null;
        if(result.ready&&motion<.018){
          goodFrames+=1;if(goodFrames>=3&&!deadline)deadline=Date.now()+3000;
          if(deadline){setCount(Math.max(1,Math.ceil((deadline-Date.now())/1000)));if(Date.now()>=deadline){captureRef.current();return;}}
        }else{goodFrames=0;deadline=0;setCount(null);}
      }catch(e){if(stopped)return;goodFrames=0;deadline=0;previous=null;setCount(null);setFeedback({ready:false,message:e instanceof Error?e.message:"Mất kết nối hướng dẫn AI.",landmarks:[]});}
      if(!stopped)next=setTimeout(check,500);
    }
    void check();return()=>{stopped=true;abort?.abort();clearTimeout(next);setCount(null);};
  },[ready,aiEnabled,side]);
  function manualCapture(){
    if(count!==null||taking.current)return;let remaining=3;setCount(remaining);
    manualTimer.current=setInterval(()=>{remaining-=1;if(remaining>0)setCount(remaining);else{if(manualTimer.current)clearInterval(manualTimer.current);setCount(null);captureRef.current();}},1000);
  }
  return <dialog ref={dialog} className="camera-dialog" onCancel={onClose}>
    <div className="dialog-title"><h2>Chụp {side?"góc nghiêng (02)":"chính diện (01)"}</h2><button className="icon-button" onClick={onClose} aria-label="Đóng camera"><X size={20}/></button></div>
    <p>{side?"Xoay người 90°, tay hơi phía sau thân, giữ đủ đầu và chân trong ảnh.":"Đứng thẳng, hướng hai vai về camera, tay hơi tách thân. Giữ đủ đầu và chân trong ảnh."}</p>
    <label className="smart-toggle"><input type="checkbox" checked={aiEnabled} disabled={!ready||(!aiEnabled&&count!==null)} onChange={e=>{setAiEnabled(e.target.checked);setCount(null);}}/><ScanLine size={16}/><span>Bật AI hướng dẫn và tự chụp</span></label>
    <p className="camera-disclosure">Bật AI nghĩa là đồng ý gửi các khung hình tới backend để kiểm tra tư thế. Không lưu hồ sơ khung hình; upload có thể dùng file tạm. Máy chỉ tự chụp khi nhận diện đúng góc và giữ yên qua nhiều lần kiểm tra.</p>
    <button className="text-button" onClick={()=>{soundRef.current=!sound;setSound(!sound);}} aria-label={sound?"Tắt âm thanh":"Bật âm thanh"}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>} Âm chụp: {sound?"bật":"tắt"}</button>
    <div className="camera-frame"><video ref={video} playsInline muted/><div className={`capture-guide ${side?"side":""} ${aiEnabled&&feedback.ready?"aligned":""}`} aria-hidden="true"/>
      {aiEnabled&&<svg className="pose-overlay" viewBox={`0 0 ${dimensions.w} ${dimensions.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">{EDGES.map(([a,b])=>feedback.landmarks[a]?.[2]>.5&&feedback.landmarks[b]?.[2]>.5?<line key={`${a}-${b}`} x1={feedback.landmarks[a][0]*dimensions.w} y1={feedback.landmarks[a][1]*dimensions.h} x2={feedback.landmarks[b][0]*dimensions.w} y2={feedback.landmarks[b][1]*dimensions.h} stroke="#a6ffca" strokeWidth={3}/>:null)}</svg>}
      {ready&&<div className={`guide-badge ${aiEnabled&&feedback.ready?"ready":""}`} role="status">{aiEnabled&&feedback.ready?<CheckCircle2 size={14}/>:<ScanLine size={14}/>}<span>{aiEnabled?feedback.message:"Chế độ thủ công — chưa kiểm tra tư thế bằng AI."}</span></div>}
      {count!==null&&<span className="countdown" aria-live="polite">{count}</span>}
    </div>
    {error&&<p role="alert" className="error-message">{error}</p>}
    <button className="primary" disabled={!ready||count!==null||aiEnabled} onClick={manualCapture}><Camera size={18}/>{aiEnabled?"AI đang kiểm tra để tự chụp":count!==null?`Chụp sau ${count}s`:"Chụp thủ công sau 3 giây"}</button>
    <p>Hướng dẫn cập nhật theo từng khung hình xử lý; không phải đo số đo liên tục. Có thể tắt AI để chụp thủ công; backend vẫn kiểm tra lại hai ảnh khi scan.</p>
  </dialog>;
}
