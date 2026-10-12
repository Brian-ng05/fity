"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowRight,Camera,Check,LoaderCircle,RotateCcw,ScanLine,X} from "lucide-react";
type Feedback={ready:boolean;message:string;landmarks:number[][]};
type Pair={front:File;side:File};
export default function CaptureSession({mode,onComplete,onCancel}:{mode:"upper_body"|"full_body";onComplete:(pair:Pair)=>void;onCancel:()=>void}){
  const video=useRef<HTMLVideoElement>(null),front=useRef<File|null>(null),alive=useRef(true),captureLock=useRef(false),run=useRef(0);
  const [view,setView]=useState<"front"|"side">("front"),[phase,setPhase]=useState<"ready"|"running"|"turn">("ready"),[devices,setDevices]=useState<MediaDeviceInfo[]>([]),[device,setDevice]=useState(""),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(false),[error,setError]=useState(""),[count,setCount]=useState<number|null>(null),[feedback,setFeedback]=useState<Feedback|null>(null),[size,setSize]=useState({w:1280,h:720});
  const upper=mode==="upper_body";
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let stream:MediaStream|undefined,stopped=false;
    run.current++;captureLock.current=false;setReady(false);setError("");setPhase("ready");setView("front");front.current=null;setCount(null);setFeedback(null);
    (async()=>{try{
      if(!navigator.mediaDevices?.getUserMedia)throw Error("Camera cần localhost hoặc HTTPS.");
      stream=await navigator.mediaDevices.getUserMedia({video:{...(device?{deviceId:{exact:device}}:{facingMode:"user"}),width:{ideal:1920},height:{ideal:1080}},audio:false});
      if(stopped){stream.getTracks().forEach(t=>t.stop());return;}
      const el=video.current;if(!el)return;el.srcObject=stream;await el.play();
      if(stopped)return;setSize({w:el.videoWidth,h:el.videoHeight});setReady(true);
      stream.getVideoTracks()[0].onended=()=>{if(!stopped){setReady(false);setPhase("ready");setError("Camera đã ngắt. Kết nối lại và bắt đầu phiên mới.");}};
      try{setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput"));}catch{}
    }catch(e){if(!stopped)setError(e instanceof DOMException&&e.name==="NotAllowedError"?"Chưa được cấp quyền camera. Cho phép camera trong trình duyệt rồi thử lại.":"Không mở được camera. Đóng ứng dụng đang dùng camera rồi thử lại.");}})();
    return()=>{stopped=true;run.current++;stream?.getTracks().forEach(t=>t.stop());};
  },[device,attempt]);
  useEffect(()=>{
    if(phase!=="turn")return;
    const timer=setTimeout(()=>{setPhase("running");setFeedback(null);},4000);
    return()=>clearTimeout(timer);
  },[phase]);
  useEffect(()=>{
    if(!ready||phase!=="running")return;
    let stopped=false,timer:ReturnType<typeof setTimeout>,abort:AbortController|undefined,previous:number[][]|null=null,stable=0,deadline=0;
    const version=run.current;
    async function check(){
      const el=video.current;if(stopped||!el||captureLock.current)return;
      try{
        const canvas=document.createElement("canvas"),scale=Math.min(1,720/Math.max(el.videoWidth,el.videoHeight));canvas.width=Math.round(el.videoWidth*scale);canvas.height=Math.round(el.videoHeight*scale);canvas.getContext("2d")?.drawImage(el,0,0,canvas.width,canvas.height);
        const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,"image/jpeg",.8));if(!blob||stopped)return;
        const body=new FormData();body.set("photo",blob,"frame.jpg");body.set("view",view);body.set("capture_mode",mode);body.set("consent","true");
        abort=new AbortController();const timeout=setTimeout(()=>abort?.abort(),5000);let response:Response;
        try{response=await fetch("/api/capture-check",{method:"POST",body,signal:abort.signal});}finally{clearTimeout(timeout);}
        const data=await response.json();if(stopped)return;if(!response.ok)throw Error(typeof data.detail==="string"?data.detail:"Không kiểm tra được tư thế.");
        const result=data as Feedback;setFeedback(result);setError("");
        const visible=(upper?[0,11,12,23,24]:[11,12,23,24,25,26,27,28]).filter(i=>result.landmarks[i]?.[2]>.55&&(previous?.[i]?.[2]||0)>.55);
        const motion=previous&&visible.length>=4?visible.reduce((n,i)=>n+Math.hypot(result.landmarks[i][0]-previous![i][0],result.landmarks[i][1]-previous![i][1]),0)/visible.length:Infinity;
        previous=result.ready?result.landmarks:null;
        if(result.ready&&motion<.018){stable++;if(stable>=3&&!deadline)deadline=Date.now()+5000;
          if(deadline){setCount(Math.max(1,Math.ceil((deadline-Date.now())/1000)));if(Date.now()>=deadline){
            captureLock.current=true;const full=document.createElement("canvas");full.width=el.videoWidth;full.height=el.videoHeight;full.getContext("2d")?.drawImage(el,0,0);
            const captured=await new Promise<Blob|null>(r=>full.toBlob(r,"image/jpeg",.92));
            if(stopped||!alive.current||version!==run.current)return;if(!captured)throw Error("Chưa chụp được ảnh. Hãy thử lại.");
            const file=new File([captured],view+".jpg",{type:"image/jpeg"});setCount(null);
            if(view==="front"){front.current=file;setView("side");setFeedback(null);setPhase("turn");captureLock.current=false;}
            else if(front.current){onComplete({front:front.current,side:file});}
            return;
          }}
        }else{stable=0;deadline=0;setCount(null);}
      }catch(e){if(stopped)return;captureLock.current=false;stable=0;deadline=0;previous=null;setCount(null);setError(e instanceof Error?e.message:"Mất kết nối kiểm tra tư thế.");}
      if(!stopped)timer=setTimeout(check,400);
    }
    void check();return()=>{stopped=true;abort?.abort();clearTimeout(timer);};
  },[ready,phase,view,mode,upper,onComplete]);
  return <section className="capture-session" aria-label="Quét hai góc liên tục">
    <header className="capture-session-head"><div><strong>Camera trực tiếp</strong><span>{view==="front"?"01 · Chính diện":"02 · Góc nghiêng"}</span></div><div><select aria-label="Chọn camera" value={device} disabled={phase!=="ready"} onChange={e=>setDevice(e.target.value)}><option value="">Camera mặc định</option>{devices.map((d,i)=><option value={d.deviceId} key={d.deviceId}>{d.label||`Camera ${i+1}`}</option>)}</select><button onClick={onCancel} aria-label="Đóng camera"><X size={19}/></button></div></header>
    <div className={`capture-live ${feedback?.ready?"pose-ready":""}`} style={{aspectRatio:`${size.w}/${size.h}`}}><video ref={video} playsInline muted/>
      <div className="capture-frame-mark" aria-hidden="true"/>
      {!ready&&!error&&<div className="capture-overlay"><LoaderCircle className="spin" size={28}/><p>Đang mở camera…</p></div>}
      {count!==null&&<div className="capture-count" aria-live="polite">{count}</div>}
      {phase==="turn"&&<div className="capture-turn" role="status"><Check size={26}/><strong>Đã chụp chính diện</strong><RotateCcw size={44}/><h2>Xoay người 90°</h2><p>Giữ nguyên vị trí. Camera sẽ tự đếm ngược khi bạn đứng đúng góc.</p></div>}
      <div className="capture-instruction"><h2>{view==="front"?"Hướng hai vai về camera":"Xoay nghiêng người 90°"}</h2><p>{upper?"Thấy đầu, vai, eo và cạp quần · Không cần thấy chân":"Giữ toàn bộ đầu và bàn chân trong khung"}</p></div>
    </div>
    <div className="capture-progress" aria-label="Tiến độ chụp"><span className={view==="front"?"active":"done"}>{view==="side"?<Check size={15}/>:"01"} Chính diện</span><i/><span className={view==="side"?"active":""}>02 Góc nghiêng</span></div>
    <div className="capture-status" role="status">{error|| (phase==="ready"?"Sẵn sàng? Bấm bắt đầu, sau đó đứng vào giữa khung.":phase==="turn"?"Đang chuyển sang góc nghiêng…":count!==null?`Giữ yên · Chụp sau ${count} giây`:feedback?.message||"Đang nhận diện tư thế…")}</div>
    <footer className="capture-session-actions">{!ready&&error?<button className="capture-primary" onClick={()=>setAttempt(n=>n+1)}><RotateCcw size={18}/>Thử lại camera</button>:phase==="ready"?<button className="capture-primary" disabled={!ready} onClick={()=>setPhase("running")}><Camera size={18}/>Bắt đầu quét<ArrowRight size={18}/></button>:<p><ScanLine size={18}/>Tự chụp hai góc · Không cần bấm thêm</p>}<button className="capture-cancel" onClick={onCancel}>Hủy phiên</button></footer>
  </section>;
}
