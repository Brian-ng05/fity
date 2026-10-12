"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ScanLine, Volume2, VolumeX, X } from "lucide-react";

type Feedback = { ready: boolean; message: string; landmarks: number[][] };
type ZoomRange = { min: number; max: number; step: number };
const INITIAL_FEEDBACK: Feedback = {ready:false,message:"Bật AI để kiểm tra toàn thân và góc chụp.",landmarks:[]};
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
  const trackRef=useRef<MediaStreamTrack|null>(null), generation=useRef(0);
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]), [deviceId,setDeviceId]=useState("");
  const [attempt,setAttempt]=useState(0), [zoomRange,setZoomRange]=useState<ZoomRange|null>(null);
  const [zoom,setZoom]=useState(1), [zoomBusy,setZoomBusy]=useState(false), [trackingVersion,setTrackingVersion]=useState(0);
  const [ready,setReady]=useState(false), [aiEnabled,setAiEnabled]=useState(false), [sound,setSound]=useState(false);
  const [error,setError]=useState(""), [count,setCount]=useState<number|null>(null);
  const [feedback,setFeedback]=useState<Feedback>({ready:false,message:"Bật AI để kiểm tra toàn thân và góc chụp.",landmarks:[]});
  const [dimensions,setDimensions]=useState({w:1920,h:1080});
  useEffect(()=>{
    alive.current=true;dialog.current?.showModal();
    return()=>{alive.current=false;generation.current+=1;};
  },[]);
  useEffect(()=>{
    let media:MediaStream|undefined;let cancelled=false;
    generation.current+=1;taking.current=false;setReady(false);setCount(null);setError("");setZoomRange(null);setZoomBusy(false);setFeedback(INITIAL_FEEDBACK);
    const el=video.current;
    const resize=()=>{if(!cancelled&&el?.videoWidth)setDimensions({w:el.videoWidth,h:el.videoHeight});};
    el?.addEventListener("resize",resize);
    (async()=>{try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera cần localhost hoặc HTTPS.");
      // No aspect-ratio constraint: retain the camera's frame instead of cropping to portrait.
      const constraints:MediaTrackConstraints & {resizeMode:{ideal:string}}={...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:"environment"}}),width:{ideal:1920},height:{ideal:1080},resizeMode:{ideal:"none"}};
      media=await navigator.mediaDevices.getUserMedia({video:constraints,audio:false});
      if(cancelled||!alive.current){media.getTracks().forEach(t=>t.stop());return;}
      const track=media.getVideoTracks()[0];trackRef.current=track;
      track.onended=()=>{if(!cancelled){setReady(false);setError("Camera đã ngắt kết nối. Kết nối lại rồi bấm Thử lại camera.");}};
      if(el){el.srcObject=media;await el.play();}
      if(cancelled||!alive.current)return;
      resize();setReady(true);
      try{
        const caps=track.getCapabilities?.() as MediaTrackCapabilities & {zoom?:ZoomRange};
        if(caps?.zoom&&Number.isFinite(caps.zoom.min)&&caps.zoom.max>caps.zoom.min){setZoomRange(caps.zoom);setZoom((track.getSettings() as MediaTrackSettings&{zoom?:number}).zoom??caps.zoom.min);}
        const list=await navigator.mediaDevices.enumerateDevices();
        if(!cancelled)setDevices(list.filter(d=>d.kind==="videoinput"));
      }catch{/* Optional device controls must not prevent capture. */}
    }catch(e){if(!cancelled&&alive.current){media?.getTracks().forEach(t=>t.stop());const name=e instanceof Error?e.name:"";setError(name==="NotAllowedError"?"Chưa được phép dùng camera. Cho phép camera trong trình duyệt rồi thử lại.":name==="NotFoundError"||name==="OverconstrainedError"?"Không tìm thấy camera đã chọn. Chọn Tự động hoặc kết nối lại camera.":"Không mở được camera. Đóng ứng dụng đang dùng camera rồi thử lại, hoặc tải ảnh từ máy.");}}})();
    return()=>{cancelled=true;generation.current+=1;trackRef.current=null;el?.removeEventListener("resize",resize);media?.getTracks().forEach(t=>t.stop());if(manualTimer.current)clearInterval(manualTimer.current);};
  },[deviceId,attempt]);
  async function changeZoom(value:number){
    const track=trackRef.current,version=generation.current;if(!track||zoomBusy)return;
    setZoomBusy(true);setCount(null);setFeedback(INITIAL_FEEDBACK);
    try{await track.applyConstraints({advanced:[{zoom:value} as MediaTrackConstraintSet]});if(version===generation.current){setZoom((track.getSettings() as MediaTrackSettings&{zoom?:number}).zoom??value);setError("");}}
    catch{if(version===generation.current)setError("Camera không áp dụng được mức zoom này. Hãy lùi xa hơn để lấy đủ toàn thân.");}
    finally{if(version===generation.current){setZoomBusy(false);setTrackingVersion(n=>n+1);}}
  }
  captureRef.current=()=>{
    const el=video.current;if(!alive.current||!ready||zoomBusy||taking.current||!el?.videoWidth)return;taking.current=true;const version=generation.current;
    const canvas=document.createElement("canvas");canvas.width=el.videoWidth;canvas.height=el.videoHeight;
    canvas.getContext("2d")?.drawImage(el,0,0);
    canvas.toBlob(blob=>{
      if(!alive.current||version!==generation.current)return;
      if(!blob){taking.current=false;setCount(null);setError("Không chụp được ảnh. Hãy thử lại.");return;}
      if(soundRef.current){try{beep();}catch{}}
      onCapture(new File([blob],side?"side.jpg":"front.jpg",{type:"image/jpeg"}));onClose();
    },"image/jpeg",.92);
  };
  useEffect(()=>{
    if(!ready||!aiEnabled||zoomBusy)return;
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
  },[ready,aiEnabled,side,deviceId,attempt,zoomBusy,trackingVersion]);
  function manualCapture(){
    if(count!==null||taking.current)return;let remaining=3;setCount(remaining);
    manualTimer.current=setInterval(()=>{remaining-=1;if(remaining>0)setCount(remaining);else{if(manualTimer.current)clearInterval(manualTimer.current);setCount(null);captureRef.current();}},1000);
  }
  return <dialog ref={dialog} className="camera-dialog" onCancel={onClose} aria-labelledby="camera-title">
    <div className="dialog-title"><h2 id="camera-title">Chụp {side?"góc nghiêng (02)":"chính diện (01)"}</h2><button className="icon-button" onClick={onClose} aria-label="Đóng camera"><X size={20}/></button></div>
    <p>{side?"Xoay người 90°, tay hơi phía sau thân, giữ đủ đầu và chân trong ảnh.":"Đứng thẳng, hướng hai vai về camera, tay hơi tách thân. Giữ đủ đầu và chân trong ảnh."}</p>
    <div className="camera-layout"><div className="camera-preview-column">
    <div className="camera-frame" style={{aspectRatio:`${dimensions.w}/${dimensions.h}`}}><video ref={video} playsInline muted/>
      <svg className="pose-overlay" viewBox={`0 0 ${dimensions.w} ${dimensions.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x={dimensions.w*.035} y={dimensions.h*.04} width={dimensions.w*.93} height={dimensions.h*.92} rx={12} fill="none" stroke={aiEnabled&&feedback.ready?"#a6ffca":"#f0f5ed"} strokeOpacity=".7" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="10 8"/>
        {aiEnabled&&EDGES.map(([a,b])=>feedback.landmarks[a]?.[2]>.5&&feedback.landmarks[b]?.[2]>.5?<line key={`${a}-${b}`} x1={feedback.landmarks[a][0]*dimensions.w} y1={feedback.landmarks[a][1]*dimensions.h} x2={feedback.landmarks[b][0]*dimensions.w} y2={feedback.landmarks[b][1]*dimensions.h} stroke="#a6ffca" strokeWidth={3} vectorEffect="non-scaling-stroke"/>:null)}
      </svg>
      {!ready&&!error&&<span className="camera-opening" role="status">Đang mở camera…</span>}
      {count!==null&&<span className="countdown" aria-live="polite">{count}</span>}
    </div>
    <div className={`camera-feedback ${aiEnabled&&feedback.ready?"ready":""}`} role="status">{aiEnabled&&feedback.ready?<CheckCircle2 size={18}/>:<ScanLine size={18}/>}<span>{!ready?"Chờ camera sẵn sàng.":aiEnabled?feedback.message:"Giữ toàn bộ đầu, tay và chân bên trong khung nét đứt."}</span></div>
    <p className="camera-resolution">{ready?`${dimensions.w} × ${dimensions.h} · Hiển thị trọn khung camera`:"Ảnh chụp giữ nguyên tỷ lệ camera"}</p>
    </div><div className="camera-options">
    <label className="camera-select">Camera<select aria-label="Chọn camera" value={deviceId} disabled={count!==null||zoomBusy} onChange={e=>{setReady(false);setDeviceId(e.target.value);}}><option value="">Tự động · ưu tiên camera sau</option>{devices.map((d,i)=><option key={d.deviceId||i} value={d.deviceId}>{d.label||`Camera ${i+1}`}</option>)}</select></label>
    {zoomRange&&<div className="camera-zoom"><label htmlFor="camera-zoom">Zoom camera <output>{zoom.toFixed(1)}×</output></label><input id="camera-zoom" type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step||.1} value={zoom} disabled={zoomBusy||count!==null||!ready} onChange={e=>void changeZoom(Number(e.target.value))}/><button className="text-button" disabled={zoomBusy||count!==null||!ready} onClick={()=>void changeZoom(zoomRange.min)}>Mở rộng tối đa camera này</button></div>}
    <p className="camera-distance">Đặt máy cố định, ngang giữa thân. Nếu thiếu đầu hoặc chân, lùi xa hơn; giữ người gần giữa ảnh để giảm méo ở rìa.</p>
    <label className="smart-toggle"><input type="checkbox" checked={aiEnabled} disabled={!ready||zoomBusy||(!aiEnabled&&count!==null)} onChange={e=>{setAiEnabled(e.target.checked);setCount(null);}}/><ScanLine size={16}/><span>Bật AI hướng dẫn và tự chụp</span></label>
    <p className="camera-disclosure">Bật AI nghĩa là đồng ý gửi các khung hình tới backend để kiểm tra tư thế. Không lưu hồ sơ khung hình; upload có thể dùng file tạm. Máy chỉ tự chụp khi nhận diện đúng góc và giữ yên qua nhiều lần kiểm tra.</p>
    <button className="text-button" onClick={()=>{soundRef.current=!sound;setSound(!sound);}} aria-label={sound?"Tắt âm thanh":"Bật âm thanh"}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>} Âm chụp: {sound?"bật":"tắt"}</button>
    {error&&<p role="alert" className="error-message">{error}</p>}
    {!ready&&error&&<button className="text-button" onClick={()=>setAttempt(n=>n+1)}>Thử lại camera</button>}
    <button className="primary" disabled={!ready||count!==null||aiEnabled||zoomBusy} onClick={manualCapture}><Camera size={18}/>{aiEnabled?"AI đang kiểm tra để tự chụp":count!==null?`Chụp sau ${count}s`:"Chụp thủ công sau 3 giây"}</button>
    <p className="camera-disclosure">Hướng dẫn cập nhật theo từng khung hình; chưa đo liên tục. Góc nhìn phụ thuộc ống kính. Có thể chọn camera góc rộng nếu thiết bị cung cấp.</p>
    </div></div>
  </dialog>;
}
