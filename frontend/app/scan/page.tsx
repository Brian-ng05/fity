"use client";
import {useState} from "react";
import FitExperience from "../../components/shop/FitExperience";
import {essential} from "../../lib/catalog";
export default function Page(){
 const [size,setSize]=useState("");
 return <main className="storefront scan-standalone"><header className="shop-header"><a href="/" className="shop-logo">MORPH<span>AI</span></a><a href="/">Về trang sản phẩm</a></header>{size&&<p className="standalone-choice" role="status">Bạn đã chọn size {size} theo bảng minh họa. <a href="/">Về trang sản phẩm để chọn mua</a></p>}<FitExperience product={essential} active onSelectSize={setSize}/></main>;
}
