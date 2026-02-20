//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\BookingFlows\basicFlow.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, } from "react";
import { useSearchParams, useRouter } from "next/navigation";

if (typeof window !== "undefined") { console.log("[flow] basicFlow.tsx loaded"); }

type SlotGroups = { morning: string[]; afternoon: string[]; evening: string[] }; type ConfirmStage = "review" | "book";

// basicFlow.tsx (and anywhere else the client calls the API)

const API =
 process.env.NEXT_PUBLIC_API_BASE_URL || 
 (process.env.NODE_ENV === "production" ? "https://api2.suiteseat.io" : 
  "http://localhost:8400"); console.log
  ("[flow] FILE CHECK basicFlow.tsx path marker: 2026-02-17 A");


console.log("[flow] API base is:", API); function unpackRows(payload: any): any[] { if (Array.isArray(payload)) 
  return payload; return payload?.items || payload?.records || payload?.rows || []; }

  // ✅ single context (no duplicates)
  const FlowCtx = createContext<FlowContextType | null>(null);

  // ✅ single hook (no duplicates)
  export function useBookingFlow() {
    const ctx = useContext(FlowCtx);

    // 👇 this proves the hook is actually being called by a component
    if (typeof window !== "undefined") {
      console.log("[flow] useBookingFlow() called", { hasProvider: !!ctx }); }

      if (!ctx) throw new Error("useBookingFlow must be used within BasicFlowProvider"); return ctx; }

      // --- amplify debug ---
      const dbg = (...args: any[]) => console.log("[flow]", ...args);


      // ==== [FLOW_TYPE] Booking flow context shape ========
      // ────────────────────────────────────────────────────────
type FlowContextType = {
   calendars: any[];
 loading: boolean;
 selectedCalendarId: string | null; 
handleCalendarSelect: (calId: string) => Promise<void>;
 heroUrl: string;
 businessRec: any | null;

 categories: any[]; 
loadingCats: boolean; 

selectedCategoryId: string | null; 
services: any[]; 
loadingServices: boolean; 
handleCategorySelect: (catId: string) => Promise<void>;

 selectedServiceId: string | null;
 selectedDateISO: string | null;
 monthCursor: Date; 
monthLabel: string; 
monthDays: { dateISO: string; isToday: boolean; isAvailable: boolean }[];

 loadingMonth: boolean;
 loadingSlots: boolean;
 slots: SlotGroups; 

serviceDurationMin: number; 
selectedTimeHHMM: string | null;
 // confirm modal 
isConfirmOpen: boolean; 
openConfirm: (timeHHMM: string) => void;
 closeConfirm: (mode?: "soft" | "hard" | boolean) => void; 
confirmStage: "review" | "book"; 
reopenConfirmAsBook: () => void; 

handleServiceSelect: (serviceId: string) => Promise<void>; 
shiftMonth: (deltaMonths: number) => Promise<void>; 
selectDate: (dateISO: string) => Promise<void>; 

// auth isLoggedIn: boolean;
 isAuthOpen: boolean; 
openAuth: () => void; 
closeAuth: () => void; 
login: (email: string, password: string) => Promise<boolean>; 
requireAuthThen: (fn: () => Promise<void> | void) => void;

 createAppointment: () => Promise<any>;
 removeBookedFromSlots: (startHHMM: string, durMin: number) => void;
 isReschedule: boolean; rescheduleApptId: string | null; 
onConfirm: () => Promise<void>;
 
goBackToCalendars: () => void; 
goBackToCategories: () => void;
 goBackToServices: () => void; 
  // multi-service
 multiSelection: string[] | null; 
handleMultiServiceSelect: (ids: string[]) => Promise<void>;

 // 🔁 picks API pickedServiceIds: string[]; 
pickedServices: any[];
 addPick: (id: string, svc: any) => void; 
removePick: (id: string) => void;
 clearPicks: () => void; 
isPicked: (id: string) => boolean; 

lookupService: (id: string) => any | null; 
currentUserId: string | null; 
currentUser: any | null; 

// 🔹 NEW: all services we’ve cached across categories 
allServices: any[]; 
calendarCells: any[]; };

