"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export interface CartItem {
  id: string; // unique line id: `${productId}__${color}__${size}`
  productId: string;
  productSlug: string;
  name: string;
  price: number;
  color: string;
  size: string;
  image: string;
  quantity: number;
}

interface CartContextValue {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "id" | "quantity">, quantity?: number) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  totalQuantity: number;
  subtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Wishlist
  wishlist: string[]; // array of product ids
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  isWishlistOpen: boolean;
  setIsWishlistOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = "morph-demo-cart-v2";
const WISHLIST_STORAGE_KEY = "morph-demo-wishlist-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCart(
            parsed.filter(
              (item: any) =>
                item &&
                typeof item.id === "string" &&
                typeof item.productId === "string" &&
                typeof item.name === "string" &&
                typeof item.price === "number" &&
                typeof item.color === "string" &&
                typeof item.size === "string" &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0 &&
                item.quantity <= 10
            )
          );
        }
      }

      const savedWishlist = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (savedWishlist) {
        const parsedW = JSON.parse(savedWishlist);
        if (Array.isArray(parsedW)) {
          setWishlist(parsedW.filter((id) => typeof id === "string"));
        }
      }
    } catch {
      // Ignore storage parse errors
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save cart changes to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, hydrated]);

  // Save wishlist changes to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {}
  }, [wishlist, hydrated]);

  const addToCart = (item: Omit<CartItem, "id" | "quantity">, quantity = 1) => {
    const lineId = `${item.productId}__${item.color}__${item.size}`;
    const qtyToAdd = Math.max(1, Math.min(10, quantity));

    setCart((prev) => {
      const existingIndex = prev.findIndex((l) => l.id === lineId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const currentQty = updated[existingIndex].quantity;
        const newQty = Math.min(10, currentQty + qtyToAdd);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      return [...prev, { ...item, id: lineId, quantity: qtyToAdd }];
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.id !== id) return line;
          const newQty = line.quantity + delta;
          if (newQty <= 0) return null;
          return { ...line, quantity: Math.min(10, newQty) };
        })
        .filter((l): l is CartItem => l !== null)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const isWishlisted = (productId: string) => wishlist.includes(productId);

  const totalQuantity = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalQuantity,
        subtotal,
        isCartOpen,
        setIsCartOpen,
        wishlist,
        toggleWishlist,
        isWishlisted,
        isWishlistOpen,
        setIsWishlistOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
