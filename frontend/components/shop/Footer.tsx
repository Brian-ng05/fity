import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CATEGORIES } from "../../lib/catalog";

export default function Footer() {
  return (
    <footer className="shop-footer-wrapper">
      <div className="shop-footer-container">
        <div className="shop-footer-col brand-col">
          <Link href="/" className="shop-logo">
            MORPH<span>STUDIO</span>
          </Link>
          <p className="footer-tagline">
            Mỗi hình thể đều khác biệt. Vừa vặn bắt đầu từ sự thấu hiểu hình thể của bạn qua công nghệ 3D.
          </p>
          <div className="footer-badge">
            <ShieldCheck size={16} />
            <span>Trải nghiệm thử nghiệm cục bộ</span>
          </div>
        </div>

        <div className="shop-footer-col">
          <h4>Danh mục thời trang</h4>
          <ul>
            <li>
              <Link href="/">Tất cả sản phẩm</Link>
            </li>
            {CATEGORIES.map((cat) => (
              <li key={cat.key}>
                <Link href={`/?category=${cat.key}#catalog`}>{cat.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="shop-footer-col">
          <h4>Công nghệ MORPH AI</h4>
          <ul>
            <li>
              <Link href="/scan">
                Phòng scan 3D độc lập <ArrowRight size={14} />
              </Link>
            </li>
            <li>
              <span className="footer-dim">Đo thân trên webcam</span>
            </li>
            <li>
              <span className="footer-dim">Đối chiếu bảng size động</span>
            </li>
            <li>
              <span className="footer-dim">Không lưu trữ ảnh riêng tư</span>
            </li>
          </ul>
        </div>

        <div className="shop-footer-col">
          <h4>Minh bạch thử nghiệm</h4>
          <p className="footer-disclaimer">
            Sản phẩm, giá bán và hình ảnh được tạo cho mục đích thử nghiệm giao diện và thuật toán định cỡ. Không xử lý thanh toán, hóa đơn hoặc giao dịch thương mại thật.
          </p>
        </div>
      </div>

      <div className="shop-footer-bottom">
        <span>© 2026 MORPH Studio · Bản quyền thuộc về nghiên cứu nội bộ</span>
        <span>Phiên bản thử nghiệm storefront 2.0</span>
      </div>
    </footer>
  );
}
