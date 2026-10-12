"use client";
import dynamic from "next/dynamic";
import {Component,useEffect,useRef,useState,type ReactNode} from "react";
import {ArrowRight,Camera,Check,CheckCircle2,Download,Info,LoaderCircle,RotateCcw,ScanLine,ShieldCheck,SlidersHorizontal,Sun,Upload,X} from "lucide-react";
import {useBodyScan} from "../../lib/useBodyScan";
import type {FitProduct} from "../../lib/catalog";
import CameraCapture from "../GuidedCamera";
import ScanResult from "./ScanResult";
const BodyViewer=dynamic(()=>import("../BodyViewer"),{ssr:false,loading:()=> <div className="viewer-loading">Đang mở hình thể…</div>});
class ViewerBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p className="viewer-fallback">Chưa mở được hình thể. Bạn vẫn có thể xem số đo và gợi ý size.</p>:this.props.children;}
}
function Photo({side,file,onFile,onCamera,disabled,upper=false}:{side:boolean;file:File|null;onFile:(file:File|null)=>void;onCamera:()=>void;disabled:boolean;upper?:boolean}){
  const input=useRef<HTMLInputElement>(null),[url,setUrl]=useState("");
  useEffect(()=>{if(!file){setUrl("");return;}const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);
  const label=side?"Góc nghiêng":"Chính diện";
  return <div className="fit-photo"><div className="fit-photo-label"><strong>{label}</strong>{file?<Check size={16}/>:<span>{side?"02":"01"}</span>}</div>
    <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label={`Ảnh ${label.toLowerCase()}`} disabled={disabled} onChange={e=>{if(e.target.files?.[0])onFile(e.target.files[0]);e.target.value="";}}/>
    <button className={`fit-photo-upload ${file?"has-photo":""}`} disabled={disabled} onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!disabled&&e.dataTransfer.files[0])onFile(e.dataTransfer.files[0]);}} aria-label={`Chọn ảnh ${label.toLowerCase()}`}>
      {url?<img src={url} alt={`Ảnh ${label.toLowerCase()} đã chọn`}/>:<><ScanLine size={36} strokeWidth={1}/><span>{side?"Xoay người 90°":upper?"Từ đầu đến cạp quần":"Thấy đủ đầu và chân"}</span><span className="upload-link"><Upload size={14}/>Tải ảnh lên</span></>}
    </button><div className="fit-photo-actions"><button className="shop-text" disabled={disabled} onClick={onCamera}><Camera size={15}/>Chụp ảnh</button>{file&&<button className="shop-icon" disabled={disabled} aria-label={`Xóa ảnh ${label.toLowerCase()}`} onClick={()=>onFile(null)}><X size={16}/></button>}</div>
  </div>;
}
type Advice={candidates:string[];message:string;status:string};
export default function FitExperience({product,onSelectSize,active}:{product:FitProduct;onSelectSize:(size:string)=>void;active:boolean}){
  const s=useBodyScan(),[advice,setAdvice]=useState<Advice|null>(null),[adviceError,setAdviceError]=useState(""),[retry,setRetry]=useState(0),[options,setOptions]=useState(false),[selected,setSelected]=useState("");
  useEffect(()=>{
    if(!s.complete||!s.job)return;const abort=new AbortController();setAdvice(null);setAdviceError("");setSelected("");
    fetch(`/api/scans/${s.job.id}/size-advice`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(product.chart),signal:abort.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(typeof data.detail==="string"?data.detail:"Chưa đối chiếu được bảng size.");return data as Advice;}).then(data=>{if(!abort.signal.aborted){setAdvice(data);if(data.candidates.length===1)setSelected(data.candidates[0]);}}).catch(e=>{if(!abort.signal.aborted)setAdviceError(e.message);});
    return()=>abort.abort();
  },[s.complete,s.job?.id,product,retry]);
  const job=s.job,step=s.complete?3:s.busy?2:1;
  if(s.complete&&job)return <ScanResult job={job} active={active} onReset={s.clear} deleting={s.deleting} onSelectSize={onSelectSize} advice={advice} adviceError={adviceError} onRetry={()=>setRetry(n=>n+1)} error={s.error}/>;
  return <div className="fit-experience">
    <ol className="fit-steps" aria-label="Các bước tìm size">{["Hai góc chụp","Phân tích hình thể","Size của bạn"].map((label,i)=><li key={label} className={step===i+1?"current":step>i+1?"done":""} aria-current={step===i+1?"step":undefined}><span>{step>i+1?<Check size={14}/>:i+1}</span>{label}</li>)}</ol>
    <div className="fit-layout"><section className="fit-form">
      {!s.complete?<><h2>{s.busy?"Đang tìm hình thể của bạn":"Bắt đầu với hai góc chụp."}</h2><p className="fit-lead">Hai ảnh và chiều cao để ước lượng hình thể, đối chiếu size của {product.name.toLowerCase()}.</p>
        <fieldset className="capture-mode" disabled={!!s.busy}><legend>Cách chụp của bạn</legend><label><input type="radio" name="capture-mode" checked={s.captureMode==="upper_body"} onChange={()=>{s.setCaptureMode("upper_body");s.choose("front",null);s.choose("side",null);}}/>Webcam · thân trên</label><label><input type="radio" name="capture-mode" checked={s.captureMode==="full_body"} onChange={()=>{s.setCaptureMode("full_body");s.choose("front",null);s.choose("side",null);}}/>Ảnh toàn thân</label></fieldset>
        <p className="capture-mode-note">{s.captureMode==="upper_body"?"Chụp từ đầu đến cạp quần, không cần thấy chân. Tỷ lệ cơ thể suy ra từ chiều cao và mẫu; số đo mông/chân không được quan sát từ ảnh.":"Thấy đủ đầu và bàn chân. Chiều cao dùng để quy đổi kích thước trên ảnh."}</p>
        <div className="fit-photos"><Photo upper={s.captureMode==="upper_body"} side={false} file={s.front} onFile={f=>s.choose("front",f)} onCamera={()=>s.setCamera("front")} disabled={!!s.busy}/><Photo upper={s.captureMode==="upper_body"} side file={s.side} onFile={f=>s.choose("side",f)} onCamera={()=>s.setCamera("side")} disabled={!!s.busy}/></div>
        <label className="fit-height" htmlFor="fit-height">Chiều cao của bạn<div><input id="fit-height" type="number" min="100" max="230" step=".1" inputMode="decimal" value={s.height} disabled={!!s.busy} onChange={e=>s.setHeight(e.target.value)}/><span>cm</span></div></label>
        <div className="fit-tip"><Sun size={19}/><span>Mặc đồ ôm sát, tay tách thân, đủ sáng. Ảnh nghiêng cần xoay 90°.</span></div>
        <label className="fit-consent"><input type="checkbox" checked={s.consent} disabled={!!s.busy} onChange={e=>s.setConsent(e.target.checked)}/><span>Tôi đồng ý xử lý ảnh để ước lượng hình thể. <button className="shop-inline" onClick={()=>s.setPrivacy(!s.privacy)} aria-expanded={s.privacy}>Về dữ liệu của bạn</button></span></label>
        {s.privacy&&<p className="fit-data-note">Ảnh gửi đến máy chủ xử lý; upload có thể dùng file tạm. Không lưu hồ sơ ảnh, không dùng ảnh để huấn luyện. Kết quả giữ tối đa một giờ; bạn có thể xóa phiên sớm.</p>}
        <button className="shop-primary" onClick={s.scan} disabled={!s.front||!s.side||!s.consent||!s.health?.ready||!!s.busy||s.deleting}>{s.busy?<><LoaderCircle className="spin" size={18}/>Đang phân tích…</>:<>Tìm size phù hợp<ArrowRight size={18}/></>}</button>
        {!s.health?.ready&&<div className="fit-connection" role="status">{s.health?"Dịch vụ phân tích chưa kết nối. Hãy thử lại.":"Đang kết nối dịch vụ phân tích…"}{s.health&&<button className="shop-inline" onClick={s.checkHealth}>Thử kết nối lại</button>}</div>}
        <p className="fit-formats">JPG, PNG, WebP · tối đa 10 MB/ảnh</p>
      </>:null}
      {s.error&&<div className="fit-error" role="alert"><Info size={17}/><div>{s.error}{s.busy&&<button className="shop-inline" onClick={()=>{s.setError("");s.setPollRetry(n=>n+1);}}>Kiểm tra kết quả</button>}</div></div>}
    </section><section className="fit-visual" aria-label="Hình thể 3D">
      <div className="fit-viewer-head"><div><strong>{s.complete?"Hình thể của bạn":"Hình thể, theo cách trực quan."}</strong><span>{s.complete?"Ước lượng từ hai ảnh":"Mẫu minh họa · chưa phải cơ thể của bạn"}</span></div><button className="shop-icon" onClick={()=>setOptions(!options)} aria-label="Tùy chọn xem 3D" aria-expanded={options}><SlidersHorizontal size={19}/></button></div>
      <div className="fit-stage viewport" ref={s.viewport}>{active&&<ViewerBoundary key={job?.model_url||"sample"}><BodyViewer url={s.complete?job?.model_url:undefined} wireframe={s.wireframe} reset={s.reset} autoRotate={s.rotation} onSelectView={()=>s.setRotation(false)} targetHeightCm={s.complete?job?.measurements?.height_cm:175} showRings={s.complete&&s.showRings} sections={s.complete?job?.body_profile?.sections:undefined} studio/></ViewerBoundary>}
        {options&&<div className="fit-viewer-options"><label><input type="checkbox" checked={s.rotation} onChange={e=>s.setRotation(e.target.checked)}/>Tự xoay mô hình</label><label><input type="checkbox" checked={s.wireframe} onChange={e=>s.setWireframe(e.target.checked)}/>Khung lưới</label>{s.complete&&<label><input type="checkbox" checked={s.showRings} onChange={e=>s.setShowRings(e.target.checked)}/>Vòng đo</label>}<button className="shop-text" onClick={()=>s.setReset(n=>n+1)}>Đặt lại góc nhìn</button></div>}
        {s.busy&&<div className="fit-processing" role="status"><LoaderCircle size={28} className="spin"/><h3>{job?.stage||"Đang gửi hai ảnh…"}</h3><p>Giữ phiên này mở. Thời gian phụ thuộc ảnh và thiết bị.</p></div>}
      </div><p className="fit-viewer-caption">Kéo để xoay · Chụm hoặc cuộn để phóng to</p><div className="fit-viewer-note"><ShieldCheck size={17}/><span>Avatar mặc lớp màu minh họa. Không phải mô phỏng chiếc áo đang chọn; khuôn mặt theo mẫu.</span></div>
    </section></div>
    {s.camera&&<CameraCapture captureMode={s.captureMode} side={s.camera==="side"} onCapture={f=>s.choose(s.camera!,f)} onClose={()=>s.setCamera(null)}/>}
  </div>;
}
