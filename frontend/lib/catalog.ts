/** Explicitly illustrative catalog. Replace with merchant-owned product data. */
export const essential = {
  id: "essential-ivory-demo",
  name: "Áo thun Essential",
  subtitle: "Một thiết kế đơn giản. Một lựa chọn vừa bạn.",
  price: 390000,
  color: "Trắng ngà",
  image: "/products/essential-ivory.png",
  sizes: ["XS", "S", "M", "L", "XL"],
  chart: {
    name: "Essential · bảng size minh họa", garment: "top", source: "illustrative", measurement_basis: "body_cm",
    rows: [
      {size:"XS",chest_cm:{min:70,max:82},waist_cm:{min:60,max:78}},
      {size:"S",chest_cm:{min:82,max:90},waist_cm:{min:64,max:82}},
      {size:"M",chest_cm:{min:90,max:98},waist_cm:{min:72,max:90}},
      {size:"L",chest_cm:{min:98,max:106},waist_cm:{min:80,max:98}},
      {size:"XL",chest_cm:{min:106,max:114},waist_cm:{min:88,max:106}},
    ],
  },
};
export type FitProduct = typeof essential;
export const money = (value:number) => new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(value);
