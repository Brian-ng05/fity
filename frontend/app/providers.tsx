"use client";

import React from "react";
import { CartProvider } from "../lib/CartContext";
import { ScanProvider } from "../lib/ScanContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ScanProvider>{children}</ScanProvider>
    </CartProvider>
  );
}
