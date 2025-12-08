//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreCartContext.tsx

"use client";
import { createContext, useContext, useState } from "react";

const Ctx = createContext<any>(null);
export function CartProvider({ children }: any){
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setOpen] = useState(false);

  function addItem(p:any){ setItems(prev => [...prev, p]); }
  function removeAt(i:number){ setItems(prev => prev.filter((_,idx)=>idx!==i)); }
  function clear(){ setItems([]); }
  function openCart(){ setOpen(true); }
  function closeCart(){ setOpen(false); }

  return (
    <Ctx.Provider value={{ items, addItem, removeAt, clear, isOpen, openCart, closeCart }}>
      {children}
      {/* TODO: a cute CartDrawer component that lists items + Checkout button */}
    </Ctx.Provider>
  );
}
export const useCart = () => useContext(Ctx);
