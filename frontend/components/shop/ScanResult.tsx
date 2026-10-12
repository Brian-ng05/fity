"use client";
import dynamic from "next/dynamic";
import {Component,useRef,useState,type ReactNode} from "react";
import {Copy,Download,Expand,RotateCcw,Rotate3D,Ruler,Box,Image as ImageIcon} from "lucide-react";
import type {Job,MeasurementDetail} from "../../lib/useBodyScan";
import type {Product} from "../../lib/catalog";
import type {SizeAdviceResult} from "../../lib/ScanContext";

const Viewer=dynamic(()=>import("../BodyViewer"),{ssr:false,loading:()=> <p className="scan-loading">Đang tải mô hình 3D…</p>});
const SOURCE:Record<MeasurementDetail["source"],string>={user_input:"Bạn nhập",photo_estimate:"Ước lượng từ ảnh",photo_with_prior:"Ảnh + tỷ lệ mẫu",template_model:"Theo mẫu 3D",unavailable:"Chưa đủ dữ liệu"};
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<p className="scan-loading">Không mở được 3D. Số đo và file tải xuống vẫn khả dụng.</p>:this.props.children;}}

export default function ScanResult({
  job,
  active,
  onReset,
  deleting,
  onSelectSize,
  advice,
  adviceError,
  onRetry,
  error,
  product,
}:{
  job:Job;
  active:boolean;
  onReset:()=>void;
  deleting:boolean;
  onSelectSize:(size:string)=>void;
  advice:SizeAdviceResult|null;
  adviceError:string;
  onRetry:()=>void;
  error:string;
  product?:Product;
}){
  const host=useRef<HTMLDivElement>(null),[rotate,setRotate]=useState(false),[rings,setRings]=useState(true),[mode,setMode]=useState("solid"),[reset,setReset]=useState(0),[unit,setUnit]=useState("cm"),[selected,setSelected]=useState(""),[notice,setNotice]=useState("");
  const rows=job.body_profile?.measurement_details||[],upper=job.body_profile?.capture_mode==="upper_body";
  const value=(m:MeasurementDetail)=>m.value_cm==null?"—":(m.value_cm/(unit==="in"?2.54:1)).toFixed(1);
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await host.current?.requestFullscreen();}catch{setNotice("Trình duyệt chưa mở được toàn màn hình. Bạn vẫn có thể kéo và phóng to mô hình.");}}
  async function copy(){try{await navigator.clipboard.writeText(JSON.stringify({unit:"cm",capture_mode:job.body_profile?.capture_mode,measurements:job.measurements,details:rows,warnings:job.warnings},null,2));setNotice("Đã sao chép JSON kèm nguồn số đo.");}catch{setNotice("Không sao chép được. Hãy dùng Tải JSON.");}}
  function snapshot(){const canvas=host.current?.querySelector("canvas");if(!canvas)return;requestAnimationFrame(()=>canvas.toBlob(blob=>{if(!blob){setNotice("Không xuất được ảnh 3D.");return;}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="morph-body.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},"image/png"));}
  
  const isBottom = product?.chart?.garment === "bottom";

  return <div className="scan-result" ref={host}>
    <header className="scan-result-heading"><div><h2>Hình thể 3D của bạn</h2><p>{job.measurements?.height_cm} cm · {upper?"Webcam thân trên":"Ảnh toàn thân"} · Hình thể ước lượng</p></div><div className="scan-header-actions"><a href={`/api/scans/${job.id}/measurements`} download><Download size={16}/>Tải JSON</a><button onClick={onReset} disabled={deleting}><RotateCcw size={16}/>{deleting?"Đang xóa…":"Chụp lại"}</button><button onClick={fullscreen}><Expand size={16}/>Toàn màn hình</button></div></header>
    <p className="scan-source-note">{upper?"Không chụp chân. Ngực/eo dựa trên ảnh và tỷ lệ vai–hông giả định; phần đầu, mông và chân theo mẫu 3D.":"Ngực/eo/mông ước lượng từ hai ảnh. Các vòng đầu, cổ và chân trích từ mẫu 3D."} Chưa kiểm chứng độ chính xác trên người thật.</p>
    <div className="scan-workspace"><aside className="scan-measure-list" aria-label="Danh sách số đo"><div className="scan-list-title"><strong>Số đo <small>{rows.length}</small></strong><div className="scan-units" aria-label="Đơn vị">{["cm","in"].map(u=><button key={u} onClick={()=>setUnit(u)} aria-pressed={unit===u}>{u}</button>)}</div></div><p>Chọn một dòng để làm nổi đường đo.</p><div className="scan-rows">{rows.map(m=><button key={m.key} className={selected===m.key?"selected":""} onClick={()=>{setSelected(selected===m.key?"":m.key);setRings(true);}} disabled={!m.points_m.length} aria-pressed={selected===m.key}><i style={{background:m.color}}/><span>{m.label}<small>{SOURCE[m.source]}</small></span><b>{value(m)}<small>{m.value_cm!=null?unit:""}</small></b></button>)}</div><p className="scan-list-foot">“Theo mẫu 3D” không phải số đo cơ thể được camera quan sát.</p></aside>
    <div className="scan-stage"><div className="scan-stage-label"><b>MORPH<span> AI</span></b><small>Mô hình ước lượng · tương tác 3D</small></div><div className="scan-tools"><button aria-pressed={rotate} onClick={()=>setRotate(!rotate)}><Rotate3D size={16}/>{rotate?"Dừng xoay":"Tự xoay"}</button><button onClick={()=>{setReset(n=>n+1);setRotate(false);}}><RotateCcw size={16}/>Đặt lại</button><button aria-pressed={rings} onClick={()=>setRings(!rings)}><Ruler size={16}/>Đường đo</button><button onClick={()=>setMode(mode==="solid"?"points":mode==="points"?"wire":"solid")}><Box size={16}/>{mode==="solid"?"Khối đặc":mode==="points"?"Điểm 3D":"Khung lưới"}</button><a href={job.model_url} download><Download size={16}/>Tải GLB</a><button onClick={snapshot}><ImageIcon size={16}/>Xuất ảnh</button></div>
      {active&&<Boundary><Viewer url={job.model_url} wireframe={mode==="wire"} points={mode==="points"} reset={reset} autoRotate={rotate} targetHeightCm={job.measurements?.height_cm} showRings={rings} technical annotations={rows} selectedMeasurement={selected} onSelectView={()=>setRotate(false)}/></Boundary>}
      <p className="scan-stage-help">Kéo để xoay · Cuộn hoặc chụm để phóng to</p>
    </div></div>
    
    <section className="scan-size-panel">
      <div>
        <h3>Chọn size cho {product?.name || "sản phẩm"}</h3>
        <p>{isBottom ? "Đối chiếu vòng eo và mông của bạn với bảng size." : "Đối chiếu vòng ngực và eo của bạn với bảng size."} Gợi ý để tham khảo.</p>
      </div>
      <div>
        {adviceError ? (
          <><p role="alert">{adviceError}</p><button onClick={onRetry}>Thử lại</button></>
        ) : !advice ? (
          <p role="status">Đang đối chiếu size…</p>
        ) : advice.status === "insufficient_measurements" ? (
          <div className="scan-advice-insufficient">
            <p><strong>Chưa đủ dữ liệu để gợi ý</strong></p>
            <small>Sản phẩm này cần số đo vòng mông. Webcam thân trên chỉ ước lượng ngực/eo từ ảnh, không đo vòng mông thực tế. Hãy chụp lại ở chế độ toàn thân để nhận gợi ý size cho sản phẩm này.</small>
          </div>
        ) : advice.candidates && advice.candidates.length > 0 ? (
          advice.candidates.map(size => (
            <button className="scan-size-apply" key={size} onClick={() => onSelectSize(size)}>
              Chọn size {size} →
            </button>
          ))
        ) : (
          <p>Không có size nào khớp tất cả số đo của bạn trong bảng. Bạn hãy xem bảng size hoặc chọn size thủ công.</p>
        )}
      </div>
    </section>

    <section className="scan-data"><h3>Dữ liệu số đo <span>{rows.filter(r=>r.value_cm!=null).length} giá trị · {unit}</span></h3><div className="scan-data-grid">{rows.map(m=><div key={m.key}><span>{m.label}</span><strong>{value(m)}<small>{m.value_cm!=null?unit:""}</small></strong><small>{SOURCE[m.source]}</small></div>)}</div><button onClick={copy}><Copy size={16}/>Sao chép JSON</button></section>
    {(notice||error)&&<p role="status" className="scan-result-notice">{error||notice}</p>}<details className="scan-limitations"><summary>Cách ước lượng & giới hạn</summary>{job.warnings?.map(w=><p key={w}>{w}</p>)}<p>Mô hình không tái tạo khuôn mặt và chưa mô phỏng quần áo. Vòng đo mẫu được cắt ngang tại các mức giải phẫu giả định; chưa dùng cho may đo.</p></details>
  </div>;
}
