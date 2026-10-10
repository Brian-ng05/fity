"use client";
import { useEffect, useState } from "react";
type Row = { size:string; chest_cm:{min:number;max:number}; waist_cm:{min:number;max:number}; hip_cm:{min:number;max:number} };
type Advice = { status:string; candidates:string[]; message:string; warning?:string };
const example:Row[] = [
  {size:"S",chest_cm:{min:82,max:90},waist_cm:{min:64,max:72},hip_cm:{min:88,max:96}},
  {size:"M",chest_cm:{min:90,max:98},waist_cm:{min:72,max:80},hip_cm:{min:96,max:104}},
  {size:"L",chest_cm:{min:98,max:106},waist_cm:{min:80,max:88},hip_cm:{min:104,max:112}},
  {size:"XL",chest_cm:{min:106,max:114},waist_cm:{min:88,max:96},hip_cm:{min:112,max:120}},
];
export default function SizeAdvice({jobId}:{jobId:string}) {
  const [rows,setRows]=useState<Row[]>(example),[garment,setGarment]=useState<"top"|"bottom">("top");
  const [custom,setCustom]=useState(false),[name,setName]=useState("Bảng minh họa"),[advice,setAdvice]=useState<Advice|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{setAdvice(null);setError("");},[rows,garment,custom,name,jobId]);
  const fields:([keyof Pick<Row,"chest_cm"|"waist_cm"|"hip_cm">,string])[]=garment==="top"?[["chest_cm","Ngực"],["waist_cm","Eo"]]:[["waist_cm","Eo"],["hip_cm","Mông"]];
  async function compare(){
    setBusy(true);setError("");setAdvice(null);
    try{
      const response=await fetch(`/api/scans/${jobId}/size-advice`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:custom?name:"Bảng minh họa",garment,source:custom?"user_provided":"illustrative",measurement_basis:"body_cm",rows:rows.map(row=>({size:row.size,...Object.fromEntries(fields.map(([key])=>[key,row[key]]))}))})});
      const data=await response.json();
      if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Kiểm tra bảng size: tên không trùng, số đo 10–250 cm, min không lớn hơn max.");
      setAdvice(data);
    }catch(e){setError(e instanceof Error?e.message:"Không đối chiếu được size.");}finally{setBusy(false);}
  }
  return <section className="size-advice" aria-label="Gợi ý size theo bảng">
    <h3>Đối chiếu size quần áo</h3>
    <p>Dùng khoảng <strong>số đo cơ thể</strong> mà nhãn hàng khuyến nghị, không nhập kích thước áo/quần trải phẳng.</p>
    <div className="size-options"><label>Loại đồ<select value={garment} disabled={busy} onChange={e=>setGarment(e.target.value as "top"|"bottom")}><option value="top">Áo · ngực và eo</option><option value="bottom">Quần · eo và mông</option></select></label><label><input type="checkbox" checked={custom} disabled={busy} onChange={e=>setCustom(e.target.checked)}/> Tôi nhập bảng của nhãn hàng</label></div>
    {custom?<label className="chart-name">Tên nhãn hàng / sản phẩm<input value={name} maxLength={100} disabled={busy} onChange={e=>setName(e.target.value)}/></label>:<p className="chart-disclaimer">Bảng bên dưới chỉ để thử chức năng, không đại diện thương hiệu hoặc “chuẩn size châu Á”.</p>}
    <div className="size-table-wrap"><table><caption>Khoảng số đo cơ thể (cm) · {custom?name:"ví dụ minh họa"}</caption><thead><tr><th>Size</th>{fields.map(([key,title])=><th key={key}>{title}: từ — đến</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td><input aria-label={`Tên size hàng ${i+1}`} value={row.size} disabled={!custom||busy} maxLength={20} onChange={e=>setRows(rows.map((r,n)=>n===i?{...r,size:e.target.value}:r))}/></td>{fields.map(([key,title])=><td key={key}><div className="range-inputs">{(["min","max"] as const).map(bound=><input key={bound} aria-label={`${row.size} ${title} ${bound==="min"?"từ":"đến"}`} type="number" min={10} max={250} step={.5} value={row[key][bound]} disabled={!custom||busy} onChange={e=>setRows(rows.map((r,n)=>n===i?{...r,[key]:{...r[key],[bound]:Number(e.target.value)}}:r))}/>)}</div></td>)}</tr>)}</tbody></table></div>
    {custom&&<div className="size-row-actions"><button className="text-button" disabled={busy||rows.length>=12} onClick={()=>setRows([...rows,{...example[0],size:`Size ${rows.length+1}`}])}>Thêm size</button><button className="text-button" disabled={busy||rows.length<=1} onClick={()=>setRows(rows.slice(0,-1))}>Bỏ hàng cuối</button></div>}
    <button className="primary" onClick={compare} disabled={busy||!name.trim()}>{busy?"Đang đối chiếu…":"Đối chiếu số đo với bảng"}</button>
    {error&&<p role="alert" className="error-message">{error}</p>}
    {advice&&<div className="size-result" role="status"><strong>{advice.candidates.length?`Size khớp khoảng: ${advice.candidates.join(" / ")}`:"Chưa có size phù hợp"}</strong><p>{advice.message}</p><p>{!custom&&"Kết quả theo bảng minh họa. "}{advice.warning}</p></div>}
  </section>;
}
