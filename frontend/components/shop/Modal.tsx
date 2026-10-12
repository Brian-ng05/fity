"use client";
import {useEffect,useRef,type ReactNode} from "react";
import {X} from "lucide-react";

export default function Modal({open,onClose,title,children,wide=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=ref.current;if(!dialog)return;
    const focus=document.activeElement as HTMLElement|null;
    if(open&&!dialog.open)dialog.showModal();
    if(!open&&dialog.open)dialog.close();
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=previous;focus?.focus();};
  },[open]);
  return <dialog ref={ref} className={`shop-modal ${wide?"fit-modal":""}`} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}>
    <div className="shop-modal-header"><span className="shop-modal-title">{title}</span><button className="shop-icon" aria-label={`Đóng ${title}`} onClick={onClose}><X size={21}/></button></div>
    {children}
  </dialog>;
}
