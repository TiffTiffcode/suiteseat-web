"use client";

import React, { useState, useEffect } from "react";
import { useLinkPageFlow, type LinkRecord } from "../../LinkFlows/linkPageFlow";
import { useRouter } from "next/navigation";
import styles from "./popup.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8400";

type DownloadFile = { url: string; name: string };

type ProductRecord = {
  _id: string;
  values: {
    "Product Name"?: string;
    Name?: string;
    Price?: number | string;
    "Sale Price"?: number | string;
    "Default Image"?: string;
    Description?: string;
    "Download Files"?: any;
    Downloads?: any;
    "Link Page"?: any;
    [key: string]: any;
  };
};

type CartItem = {
  key: string;                 // unique per item (type + id)
  type: "link" | "product";
  id: string;
  title: string;
  price?: number | null;
  salePrice?: number | null;
  thumbnail?: string;
  quantity: number;
};


// Optional helper: normalize whatever shape your downloads are in
function normalizeDownloads(raw: any): DownloadFile[] {
  const out: DownloadFile[] = [];

  function addOne(item: any) {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach(addOne);
      return;
    }

    if (typeof item === "string") {
      out.push({ url: item, name: "Download" });
      return;
    }

    if (typeof item === "object") {
      const url = item.url || item.path || item.fileUrl || item.file || "";
      if (!url) return;
      const name =
        item.name || item.filename || item.originalname || "Download";
      out.push({ url, name });
    }
  }

  addOne(raw);
  return out;
}

type LinkTemplateProps = {
  slug?: string;
};

export default function BasicLinkTemplate(_props: LinkTemplateProps) {
  const router = useRouter();

  // 🔹 NEW: which tab is active?
  const [activeTab, setActiveTab] = useState<"links" | "shop">("links");

  // 🔹 Popup state
  const [showOrderPopup, setShowOrderPopup] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([]);

  const { loading, error, page, links } = useLinkPageFlow();
  const [selectedLink, setSelectedLink] = useState<LinkRecord | null>(null);

  const [showAuth, setShowAuth] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // 🔹 login form + error state
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 🔹 NEW: which product are we checking out for?
  const [checkoutProduct, setCheckoutProduct] = useState<ProductRecord | null>(
    null
  );

  // 🔹 NEW: does this page actually have links / products?
  const hasLinks = Array.isArray(links) && links.length > 0;
  const [hasShop, setHasShop] = useState<boolean | null>(null);

  // 🛒 Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // total items (for the little number on the cart icon)
  const cartCount = cartItems.reduce(
    (sum, item) => sum + (item.quantity || 1),
    0
  );
  // 🛒 Show/hide cart popup
  const [showCart, setShowCart] = useState(false);

  // 🧮 Cart total (uses sale price if available)
  const cartTotal = cartItems.reduce((sum, item) => {
    const unit = item.salePrice ?? item.price ?? 0;
    const qty = item.quantity || 1;
    return sum + unit * qty;
  }, 0);


    // 🧩 Add a Link-based item to cart
  function addLinkToCart(link: LinkRecord) {
    const v = link.values || {};
    const title = v.Title || "Link";
    const price = v.Price ?? null;
    const sale = v["Sale Price"] ?? null;
    const thumb = v["Thumbnail Image"];

    const key = `link:${link._id}`;

    setCartItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key,
          type: "link",
          id: link._id,
          title,
          price: typeof price === "number" ? price : null,
          salePrice: typeof sale === "number" ? sale : null,
          thumbnail: typeof thumb === "string" ? thumb : undefined,
          quantity: 1,
        },
      ];
    });
  }

  // 🧩 Add a Product-based item to cart
  function addProductToCart(product: ProductRecord) {
    const v = product.values || {};
    const title = v["Product Name"] || v.Name || "Product";
    const price = v.Price ?? null;
    const sale = v["Sale Price"] ?? null;
    const thumb = v["Default Image"];

    const key = `product:${product._id}`;

    setCartItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key,
          type: "product",
          id: product._id,
          title,
          price: typeof price === "number" ? price : null,
          salePrice: typeof sale === "number" ? sale : null,
          thumbnail: typeof thumb === "string" ? thumb : undefined,
          quantity: 1,
        },
      ];
    });
  }

   function removeFromCart(key: string) {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  }


  // 🔹 NEW EFFECT: check if this Link Page has any Products
  useEffect(() => {
    let cancelled = false;

    async function checkHasProducts() {
      if (!page?._id) {
        setHasShop(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("dataType", "Product");
        // field name is "Link Page" in your Product values
        params.set("Link Page", page._id);
        params.set("limit", "1");

        const res = await fetch(
          `${API}/public/records?${params.toString()}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();
        const rows: ProductRecord[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.records)
          ? raw.records
          : Array.isArray(raw?.items)
          ? raw.items
          : [];

        if (cancelled) return;
        setHasShop(rows.length > 0);
      } catch (err) {
        if (cancelled) return;
        console.error("[BasicLinkTemplate] checkHasProducts error:", err);
        setHasShop(false);
      }
    }

    checkHasProducts();
    return () => {
      cancelled = true;
    };
  }, [page?._id]);

  if (loading)
    return <div className="bk-container py-10 text-center">Loading links…</div>;
  if (error)
    return (
      <div className="bk-container py-10 text-center text-red-600">
        {error}
      </div>
    );
  if (!page)
    return (
      <div className="bk-container py-10 text-center text-red-600">
        Link Page not found.
      </div>
    );

  const v = page.values;
  const title = v["Link Page Name"] || v["Page Name"] || "My Link Page";

  const headerImg = v["Header Image"];
  const pageBgColor = v["Page Background Color"] || "#ffffff";
  const pageBgImg = v["Page Background Image"];
  const linkBg = v["Link Background Color"] || "#ff6600";
  const linkText = v["Link Text Color"] || "#111111";
  const btnBg = v["Link Button Color"] || "#ff6600";
  const btnText = v["Link Button Text Color"] || "#ffffff";

  const isMulti = !selectedLink && links.length > 1;

  // =========================================================
  // Order flow for LINKS
  // =========================================================
async function placeOrderForSelectedLink(
  userId: string,
  userEmail: string,
  userFirstName: string,
  userLastName: string,

  page?: any
) {

    if (!selectedLink) {
      console.warn("[placeOrder] no selectedLink");
      return;
    }

    try {
      const v: any = selectedLink.values || {};
      console.log("[placeOrder] START – selectedLink:", {
        linkId: selectedLink._id,
        title: v.Title,
        url: v.URL,
        raw: selectedLink,
      });

      // 1️⃣ Resolve Product for this link
      const productRef = v.Product || v["Product"] || null;

      let productId = productRef?._id || productRef || "";
      let productValues: any = {}; // will fill once we know the product
      let productDefaultImage: any = null;
      let productDescription: string = "";

      if (!productId) {
        const searchParams = new URLSearchParams();
        searchParams.set("dataType", "Product");
        searchParams.set("Link", selectedLink._id);

        const searchUrl = `${API}/public/records?${searchParams.toString()}`;
        console.log("[placeOrder] searching Product by Link via:", searchUrl);

        const res = await fetch(searchUrl, { credentials: "include" });
        const bodyText = await res.text();
        console.log("[placeOrder] search Products status:", res.status);
        console.log("[placeOrder] search Products body:", bodyText);

        if (!res.ok) {
          console.warn(
            "[placeOrder] could not find Product by Link:",
            res.status
          );
          return;
        }

        let rows: any[] = [];
        try {
          const parsed = JSON.parse(bodyText);
          rows = Array.isArray(parsed)
            ? parsed
            : parsed.records || parsed.items || [];
        } catch (e) {
          console.error("[placeOrder] JSON parse error for Products:", e);
          return;
        }

        console.log("[placeOrder] products for this link:", rows);
        if (!rows.length) {
          console.warn(
            "[placeOrder] no Product rows found for Link",
            selectedLink._id
          );
          return;
        }

        // 🟢 Prefer a Product that actually has a Default Image
        let chosen = rows.find(
          (r: any) => r.values && r.values["Default Image"]
        );
        if (!chosen) {
          chosen = rows[0]; // fallback
        }

        productId = chosen._id;
        productValues = chosen.values || {};

        console.log("[placeOrder] chosen Product:", {
          productId,
          defaultImage: productValues["Default Image"],
          description: productValues["Description"],
        });
      } else {
        // If the Link already has a Product ref with values, you *could* read from that:
        if ((productRef as any).values) {
          productValues = (productRef as any).values;
        }
      }

      if (!productId) {
        console.warn("[placeOrder] no Product id found for selected link");
        return;
      }

      // 🔹 pull image + description off the Product values
      productDefaultImage = productValues["Default Image"] || null;
      productDescription = productValues["Description"] || "";

      // 🔹 grab ALL possible download fields from the Product + Link
      const linkValues: any = selectedLink.values || {};

      const rawDownloadSources = [
        // from Product
        productValues["Downloads"],
        productValues["Digital downloads"],
        productValues["Digital Downloads"],
        productValues["Result Files"],
        productValues["Result File"],
        productValues["File(s)"],

        // from Link (in case you attached files there instead)
        linkValues["Downloads"],
        linkValues["Digital downloads"],
        linkValues["Digital Downloads"],
        linkValues["Result Files"],
        linkValues["Result File"],
        linkValues["File(s)"],
      ];

      const mergedRawDownloads: any[] = [];

      for (const src of rawDownloadSources) {
        if (!src) continue;
        if (Array.isArray(src)) {
          mergedRawDownloads.push(...src);
        } else {
          mergedRawDownloads.push(src);
        }
      }

      // ✅ normalize everything into { url, name }[]
      const productDownloads: DownloadFile[] =
        normalizeDownloads(mergedRawDownloads);

      console.log("[placeOrder] rawDownloadSources:", rawDownloadSources);
      console.log("[placeOrder] mergedRawDownloads:", mergedRawDownloads);
      console.log(
        "[placeOrder] normalized productDownloads:",
        productDownloads
      );

      const linkTitle =
        linkValues["Link Title"] || linkValues["Title"] || "Order";

      const price = linkValues["Price"] ?? linkValues["Amount"] ?? null;

      const salePrice = linkValues["Sale Price"] ?? price ?? null;

       const orderValues: any = {
        Status: "saved",
        "Purchased Date": new Date().toISOString(),
        Product: { _id: productId },
        Link: { _id: selectedLink._id },
        Customer: { _id: userId },

        // ⭐ SNAPSHOT FIELDS
        "Customer First Name": userFirstName || "",
        "Customer Last Name": userLastName || "",
        "Customer Email": userEmail || "",

        "Product Name": linkTitle,
      };

          // 👇 NEW: store denormalized customer info on the Order itself
    // 👇 NEW: save name fields directly on the Order
if (userFirstName || userLastName) {
  orderValues["Customer First Name"] = userFirstName;
  orderValues["Customer Last Name"] = userLastName;
  const displayName = [userFirstName, userLastName].filter(Boolean).join(" ").trim();
  orderValues["Customer Name"] =
    displayName || userEmail || `User ${String(userId).slice(-4)}`;
}
      if (userEmail) {
        orderValues["Customer Email"] = userEmail;
      }
      if (Array.isArray(productDownloads) && productDownloads.length) {
        orderValues["Downloads"] = productDownloads;
      }
      if (productDefaultImage) {
        orderValues["Thumbnail"] = productDefaultImage;
      }
      if (productDescription) {
        orderValues["Description"] = productDescription;
      }
      if (page?._id) {
        orderValues["Link Page"] = { _id: page._id };
      }
      if (price != null) orderValues["Price"] = Number(price);
      if (salePrice != null) orderValues["Sale Price"] = Number(salePrice);

      console.log(
        "[placeOrder] creating Order via /api/records/Order",
        orderValues
      );

      // 3️⃣ Create Order
      const orderRes = await fetch(`${API}/api/records/Order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ values: orderValues }),
      });

      const orderText = await orderRes.text().catch(() => "");
      console.log(
        "[placeOrder] /api/records/Order status:",
        orderRes.status,
        orderText
      );

      if (!orderRes.ok) {
        console.warn("[placeOrder] failed to create Order record");
        return;
      }

      console.log("[ORDER PLACED]", {
        userId,
        userEmail,
        productId,
        linkId: selectedLink._id,
        linkTitle: v.Title || v.title || "",
      });

      // ✅ SHOW POPUP RIGHT HERE
      openOrderSuccessPopup(productDownloads);
    } catch (err) {
      console.error("[placeOrder] error", err);
    }
  }

async function placeOrderForProduct(
  userId: string,
  userEmail: string,
  userFirstName: string,
  userLastName: string,
 
  product: ProductRecord,
  page?: any
) {

    if (!product?._id) {
      console.warn("[placeOrderProduct] no product id");
      return;
    }

    try {
      const v: any = product.values || {};

      const productId = product._id;
      const productName = v["Product Name"] || v.Name || "Product";

      const price = v["Price"] ?? v.Price ?? null;

      const salePrice = v["Sale Price"] ?? price ?? null;

      const thumb = v["Default Image"] || null;
      const desc = v.Description || "";

      // 🔹 gather all potential download fields from Product
      const rawDownloadSources = [
        v["Download Files"],
        v["Downloads"],
        v["Digital downloads"],
        v["Digital Downloads"],
        v["Result Files"],
        v["Result File"],
        v["File(s)"],
      ];

      const mergedRawDownloads: any[] = [];
      for (const src of rawDownloadSources) {
        if (!src) continue;
        if (Array.isArray(src)) {
          mergedRawDownloads.push(...src);
        } else {
          mergedRawDownloads.push(src);
        }
      }

      // ✅ normalize into { url, name }[]
      const productDownloads: DownloadFile[] =
        normalizeDownloads(mergedRawDownloads);

       const orderValues: any = {
        Status: "saved",
        "Purchased Date": new Date().toISOString(),
        Product: { _id: productId },
        Customer: { _id: userId },

        // ⭐ SNAPSHOT FIELDS
        "Customer First Name": userFirstName || "",
        "Customer Last Name": userLastName || "",
        "Customer Email": userEmail || "",

        "Product Name": productName,
      };

 // 👇 NEW: save name fields
if (userFirstName || userLastName) {
  orderValues["Customer First Name"] = userFirstName;
  orderValues["Customer Last Name"] = userLastName;
  const displayName = [userFirstName, userLastName].filter(Boolean).join(" ").trim();
  orderValues["Customer Name"] =
    displayName || userEmail || `User ${String(userId).slice(-4)}`;
}
      if (userEmail) {
        orderValues["Customer Email"] = userEmail;
      }
      if (productDownloads.length) {
        orderValues["Downloads"] = productDownloads;
      }
      if (thumb) {
        orderValues["Thumbnail"] = thumb;
      }
      if (desc) {
        orderValues["Description"] = desc;
      }

      // Link Page – prefer page._id, fallback to Product's "Link Page" ref
      const lpRef = v["Link Page"];
      const linkPageId = page?._id || lpRef?._id || lpRef || null;
      if (linkPageId) {
        orderValues["Link Page"] = { _id: linkPageId };
      }

      if (price != null) orderValues["Price"] = Number(price);
      if (salePrice != null) orderValues["Sale Price"] = Number(salePrice);

      console.log(
        "[placeOrderProduct] creating Order via /api/records/Order",
        orderValues
      );

      const orderRes = await fetch(`${API}/api/records/Order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ values: orderValues }),
      });

      const orderText = await orderRes.text().catch(() => "");
      console.log(
        "[placeOrderProduct] /api/records/Order status:",
        orderRes.status,
        orderText
      );

      if (!orderRes.ok) {
        console.warn("[placeOrderProduct] failed to create Order record");
        return;
      }

      console.log("[ORDER PLACED – PRODUCT]", {
        userId,
        userEmail,
        productId,
        productName,
      });

      // ✅ show same popup
      openOrderSuccessPopup(productDownloads);
    } catch (err) {
      console.error("[placeOrderProduct] error", err);
    }
  }

 async function handleLogin(e: any) {
  e.preventDefault();
  setAuthError(null);
  setAuthLoading(true);

  try {
    // 1️⃣ Login
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: authEmail,
        password: authPassword,
      }),
    });

    if (!res.ok) {
      let msg = `Login failed (HTTP ${res.status})`;
      try {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } catch {}
      throw new Error(msg);
    }

    // 2️⃣ Get logged-in user info
    const meRes = await fetch(`${API}/check-login`, {
      credentials: "include",
      cache: "no-store",
    });
    const me = await meRes.json().catch(() => ({}));
    console.log("[link login] me:", me);

    const userId = String(me.userId || me.id || "");
    const userEmail = me.email || authEmail || "";

        // 👇 NEW: build a nice display name
      const userFullName =
        [me.firstName, me.lastName].filter(Boolean).join(" ").trim() ||
        me.name ||
        `User ${String(userId).slice(-4)}`;

    // ⭐ NEW: grab first + last name
    const userFirstName =
      me.firstName || me.firstname || me.first || "";
    const userLastName =
      me.lastName || me.lastname || me.last || "";

    console.log("[link login] using userId/userEmail/name:", {
      userId,
      userEmail,
      userFirstName,
      userLastName,
    });

if (userId) {
  if (checkoutProduct) {
    await placeOrderForProduct(
      userId,
      userEmail,
      userFirstName,
      userLastName,
      checkoutProduct,
      page
    );
  } else if (selectedLink) {
    await placeOrderForSelectedLink(
      userId,
      userEmail,
      userFirstName,
      userLastName,
      page
    );
  }
}



    // 4️⃣ Clean up
    setAuthLoading(false);
    setShowAuth(false);
    setAuthPassword("");
    setCheckoutProduct(null);
  } catch (err: any) {
    console.error("[link login] error", err);
    setAuthError(err?.message || "Login failed");
    setAuthLoading(false);
  }
}


  // Call this after Stripe/order success
  function openOrderSuccessPopup(downloadSource: any) {
    const files = normalizeDownloads(downloadSource);
    setDownloadFiles(files);
    setShowDownloads(false);
    setShowOrderPopup(true);
  }

  function handleCloseAndRefresh() {
    setShowOrderPopup(false);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  function handleGoToDashboard() {
    router.push("/client-dashboard.html"); // ⬅️ change path if your dashboard route is different
  }

  // =========================================================
  // RENDER
  // =========================================================
  return (
   <main
  className="min-h-screen bk-container flex justify-center py-10"
  style={{
    backgroundColor: pageBgColor,
    backgroundImage: pageBgImg ? `url(${pageBgImg})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }}
>
  <div className="max-w-3xl w-full px-5">
   {/* 🔹 Top bar with cart on the right */}
<div
  className="flex items-center justify-end mb-4 rounded-2xl px-3 py-2 shadow-sm border border-black/5"
  style={{ backgroundColor: "#f9f5f0" }}  // off-white bar
>
<button
  type="button"
  className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-md border border-black/5"
  aria-label="Open cart"
  onClick={() => setShowCart(true)}   // 👈 open popup
>
  <span className="text-xl">🛒</span>

  {cartCount > 0 && (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-black text-white">
      {cartCount}
    </span>
  )}
</button>

</div>


    {/* existing center header (image + big title) */}
    <div className="flex flex-col items-center mb-6">
      {headerImg && (
        <img
          src={headerImg}
          alt={title}
          className="w-28 h-28 rounded-full object-cover mb-3 shadow-md border-4 border-white"
        />
      )}
      <h1
        className="text-xl font-semibold text-center tracking-wide drop-shadow-md"
        style={{ color: linkText }}
      >
        {title}
      </h1>
    </div>


        {/* 🔹 Tabs – only show if that section actually exists */}
        {(hasLinks || hasShop) && (
          <div className="flex justify-center mb-6 gap-2">
            {hasLinks && (
              <button
                type="button"
                onClick={() => setActiveTab("links")}
                className={`px-4 py-2 text-xs font-semibold rounded-full border ${
                  activeTab === "links"
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-300"
                }`}
              >
                Links
              </button>
            )}

            {hasShop && (
              <button
                type="button"
                onClick={() => setActiveTab("shop")}
                className={`px-4 py-2 text-xs font-semibold rounded-full border ${
                  activeTab === "shop"
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-300"
                }`}
              >
                Shop
              </button>
            )}
          </div>
        )}

        {/* 🔹 TAB CONTENT */}
        {activeTab === "links" && hasLinks ? (
          // ----- LINKS TAB -----
          selectedLink ? (
            <SelectedLinkDetails
              link={selectedLink}
              linkBg={linkBg}
              linkText={linkText}
              btnBg={btnBg}
              btnText={btnText}
              onBack={() => setSelectedLink(null)}
              onBuyClick={(url) => {
                setPendingUrl(url);
                setShowAuth(true); // open popup
              }}
            />
          ) : (
            <div
              className={
                isMulti
                  ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                  : "grid grid-cols-1 gap-4 justify-items-center"
              }
            >
              {links.map((link: LinkRecord) => {
                const lv = link.values || {};
                const lt = lv.Title || "Link";
                const url = lv.URL || "#";
                const subtitle = lv.Subtitle || "";
                const desc = lv["Long Description"] || "";
                const price = lv.Price;
                const sale = lv["Sale Price"];
                const thumb = lv["Thumbnail Image"];

                return (
                  <div
                    key={link._id}
                    className="rounded-3xl p-4 flex gap-3 no-underline cursor-pointer"
                    style={{
                      backgroundColor: linkBg,
                      color: linkText,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                      maxWidth: "420px",
                      width: "100%",
                    }}
                  >
                    {thumb && (
                      <img
                        src={thumb}
                        alt={lt}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-black/20"
                      />
                    )}

                    <div className="flex-1 flex flex-col gap-1">
                      <div className="font-semibold text-sm">{lt}</div>
                      {subtitle && (
                        <div className="text-xs opacity-80">{subtitle}</div>
                      )}
                      {desc && (
                        <div className="text-xs opacity-90 line-clamp-2">
                          {desc}
                        </div>
                      )}

                      {(price != null || sale != null) && (
                        <div className="text-xs mt-1">
                          {sale != null && sale !== "" ? (
                            <>
                              {price != null && price !== "" && (
                                <span className="line-through mr-1">
                                  ${Number(price).toFixed(2)}
                                </span>
                              )}
                              <span>${Number(sale).toFixed(2)}</span>
                            </>
                          ) : (
                            price != null &&
                            price !== "" && (
                              <span>${Number(price).toFixed(2)}</span>
                            )
                          )}
                        </div>
                      )}

                <div className="mt-3 flex gap-2">
  <button
    className="px-5 py-2 rounded-full text-xs font-semibold border-none"
    style={{ backgroundColor: btnBg, color: btnText }}
    onClick={() => setSelectedLink(link)}
  >
    Buy Now
  </button>

  <button
    type="button"
    className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white/80"
    style={{ color: linkText }}
    onClick={() => addLinkToCart(link)}   // 🛒 NEW
  >
    + Cart
  </button>
</div>

                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // ----- SHOP TAB -----
          <ShopTab
            pageId={page._id}
            linkBg={linkBg}
            linkText={linkText}
            btnBg={btnBg}
            btnText={btnText}
            onProductBuy={(product) => {
              // when Buy Now is pressed in Shop
              setCheckoutProduct(product);
              setShowAuth(true); // open the same login popup
            }}
             onAddToCart={addProductToCart} 
          />
        )}
      </div>

      {/* 🛒 Cart popup */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Cart</h2>
              <button
                type="button"
                className="text-sm text-gray-500"
                onClick={() => setShowCart(false)}
              >
                ✕
              </button>
            </div>

            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-600">
                Your cart is empty.
              </p>
            ) : (
              <>
                <ul className="space-y-3 mb-4">
                  {cartItems.map((item) => {
                    const unit = item.salePrice ?? item.price ?? 0;
                    const qty = item.quantity || 1;
                    const lineTotal = unit * qty;

                    return (
                      <li
                        key={item.key}
                        className="flex items-center gap-3 border-b border-gray-100 pb-2"
                      >
                        {item.thumbnail && (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-10 h-10 rounded-md object-cover border border-black/10 flex-shrink-0"
                          />
                        )}

                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {item.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            Qty: {qty}
                          </div>
                        </div>

                        <div className="text-xs text-right">
                          {typeof unit === "number" && !isNaN(unit) && (
                            <div>
                              ${unit.toFixed(2)}
                              {qty > 1 && (
                                <span className="text-gray-400">
                                  {" "}
                                  × {qty}
                                </span>
                              )}
                            </div>
                          )}
                          {typeof lineTotal === "number" && !isNaN(lineTotal) && (
                            <div className="font-semibold">
                              ${lineTotal.toFixed(2)}
                            </div>
                          )}
                        </div>
        {/* 🗑️ remove button */}
        <button
          type="button"
          className="text-xs text-gray-400 hover:text-red-500"
          onClick={() => removeFromCart(item.key)}
          aria-label="Remove from cart"
        >
          🗑️
        </button>

                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between border-t border-gray-200 pt-3 mb-4">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-base font-semibold">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-full border border-gray-300"
                    onClick={() => setShowCart(false)}
                  >
                    Close
                  </button>

                  {/* Placeholder: future multi-item checkout */}
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-full font-semibold"
                    style={{ backgroundColor: btnBg, color: btnText }}
                    onClick={() => {
                      // later we’ll hook this into multi-item checkout
                      alert("Multi-item checkout coming next ✨");
                    }}
                  >
                    Checkout all
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}





      {/* Auth popup */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-2">Log in to continue</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter your email and password to continue.
            </p>

            {authError && (
              <div className="mb-3 text-xs text-red-600">{authError}</div>
            )}

            <form onSubmit={handleLogin} className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-full border border-gray-300"
                  onClick={() => setShowAuth(false)}
                >
                  Not now
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm rounded-full font-semibold disabled:opacity-60"
                  style={{ backgroundColor: btnBg, color: btnText }}
                  disabled={authLoading}
                >
                  {authLoading ? "Logging in..." : "Log in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Order Success Popup */}
      {showOrderPopup && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            {!showDownloads && (
              <>
                <h2 className={styles.title}>
                  Thank you for your purchase 🎉
                </h2>
                <p className={styles.text}>Your order was successful.</p>

                <div className={styles.buttons}>
                  {downloadFiles.length > 0 && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => setShowDownloads(true)}
                    >
                      View downloads
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.btn}
                    onClick={handleGoToDashboard}
                  >
                    Go to my dashboard
                  </button>

                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={handleCloseAndRefresh}
                  >
                    Close and refresh
                  </button>
                </div>
              </>
            )}

            {showDownloads && (
              <>
                <h2 className={styles.title}>Your downloads</h2>
                {downloadFiles.length ? (
                  <ul className={styles.downloadsList}>
                    {downloadFiles.map((f, idx) => {
                      const fullUrl = f.url.startsWith("http")
                        ? f.url
                        : `${process.env.NEXT_PUBLIC_API_BASE || ""}${f.url}`;
                      return (
                        <li
                          key={idx}
                          className={styles.downloadsListItem}
                        >
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.downloadLink}
                          >
                            {f.name || `File ${idx + 1}`}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.text}>
                    No downloads found for this order.
                  </p>
                )}

                <div className={styles.buttons}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={handleGoToDashboard}
                  >
                    Go to my dashboard
                  </button>

                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={handleCloseAndRefresh}
                  >
                    Done (refresh page)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/** 🔹 Separate component just to keep JSX tidy */
function SelectedLinkDetails({
  link,
  linkBg,
  linkText,
  btnBg,
  btnText,
  onBack,
  onBuyClick,
}: {
  link: LinkRecord;
  linkBg: string;
  linkText: string;
  btnBg: string;
  btnText: string;
  onBack: () => void;
  onBuyClick: (url: string) => void;
}) {
  const v = link.values || {};
  const lt = v.Title || "Link";
  const url = v.URL || "#";
  const desc = v["Long Description"] || "";
  const price = v.Price;
  const sale = v["Sale Price"];
  const thumb = v["Thumbnail Image"];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* back link */}
      <button
        onClick={onBack}
        className="text-xs mb-2 px-3 py-1 rounded-full bg-white/70 shadow-sm"
        style={{ color: linkText }}
      >
        ← Back to all links
      </button>

      <div
        className="rounded-3xl p-6 flex flex-col items-center gap-3"
        style={{
          backgroundColor: linkBg,
          color: linkText,
          boxShadow: "0 14px 30px rgba(0, 0, 0, 0.28)",
          maxWidth: "640px",
          width: "100%",
        }}
      >
        {thumb && (
          <div className="w-full mb-4 flex justify-center">
            <img
              src={thumb}
              alt={lt}
              className="max-w-full max-h-96 object-contain rounded-3xl"
            />
          </div>
        )}

        <div className="text-center w-full">
          <div className="font-semibold text-lg mb-1">{lt}</div>

          {desc && (
            <div className="text-sm opacity-90 mb-3 whitespace-pre-line">
              {desc}
            </div>
          )}

          {(price != null || sale != null) && (
            <div className="text-sm mb-4">
              {sale != null && sale !== "" ? (
                <>
                  {price != null && price !== "" && (
                    <span className="line-through mr-2">
                      ${Number(price).toFixed(2)}
                    </span>
                  )}
                  <span className="font-semibold">
                    ${Number(sale).toFixed(2)}
                  </span>
                </>
              ) : (
                price != null &&
                price !== "" && (
                  <span className="font-semibold">
                    ${Number(price).toFixed(2)}
                  </span>
                )
              )}
            </div>
          )}

          {/* Buy Now: just opens login popup */}
          <button
            className="px-6 py-2 rounded-full text-sm font-semibold border-none"
            style={{ backgroundColor: btnBg, color: btnText }}
            onClick={() => onBuyClick(url)}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

// 🔹 SHOP TAB – shows Products attached to this Link Page
function ShopTab({
  pageId,
  linkBg,
  linkText,
  btnBg,
  btnText,
  onProductBuy,
    onAddToCart,  
}: {
  pageId: string;
  linkBg: string;
  linkText: string;
  btnBg: string;
  btnText: string;
  onProductBuy: (product: ProductRecord) => void;
  onAddToCart: (product: ProductRecord) => void; 
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);

  // 🔹 NEW: which product is selected in the Shop tab?
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!pageId) return;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("dataType", "Product");
        // field name is "Link Page" in your Product values
        params.set("Link Page", pageId);
        params.set("limit", "200");

        const res = await fetch(
          `${API}/public/records?${params.toString()}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();
        const rows: ProductRecord[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.records)
          ? raw.records
          : Array.isArray(raw?.items)
          ? raw.items
          : [];

        if (cancelled) return;
        setProducts(rows);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[ShopTab] load products error:", err);
        setError(err?.message || "Failed to load products");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (loading) {
    return (
      <div className="py-10 text-center text-sm" style={{ color: linkText }}>
        Loading products…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="py-10 text-center text-sm" style={{ color: linkText }}>
        No products in this shop yet.
      </div>
    );
  }

  // 🔹 If a product is selected → show DETAILS view (like SelectedLinkDetails)
  if (selectedProduct) {
    const v = selectedProduct.values || {};
    const name = v["Product Name"] || v.Name || "Product";
    const price = v.Price;
    const sale = v["Sale Price"];
    const img = v["Default Image"];
    const desc = v.Description || "";

    return (
      <div className="flex flex-col items-center gap-4">
        {/* back link */}
        <button
          onClick={() => setSelectedProduct(null)}
          className="text-xs mb-2 px-3 py-1 rounded-full bg-white/70 shadow-sm"
          style={{ color: linkText }}
        >
          ← Back to all products
        </button>

        <div
          className="rounded-3xl p-6 flex flex-col items-center gap-3"
          style={{
            backgroundColor: linkBg,
            color: linkText,
            boxShadow: "0 14px 30px rgba(0,0,0,0.28)",
            maxWidth: "640px",
            width: "100%",
          }}
        >
          {img && (
            <div className="w-full mb-4 flex justify-center">
              <img
                src={img as string}
                alt={name}
                className="max-w-full max-h-96 object-contain rounded-3xl"
              />
            </div>
          )}

          <div className="text-center w-full">
            <div className="font-semibold text-lg mb-1">{name}</div>

            {desc && (
              <div className="text-sm opacity-90 mb-3 whitespace-pre-line">
                {desc}
              </div>
            )}

            {(price != null || sale != null) && (
              <div className="text-sm mb-4">
                {sale != null && sale !== "" ? (
                  <>
                    {price != null && price !== "" && (
                      <span className="line-through mr-2">
                        ${Number(price).toFixed(2)}
                      </span>
                    )}
                    <span className="font-semibold">
                      ${Number(sale).toFixed(2)}
                    </span>
                  </>
                ) : (
                  price != null &&
                  price !== "" && (
                    <span className="font-semibold">
                      ${Number(price).toFixed(2)}
                    </span>
                  )
                )}
              </div>
            )}

            <button
              className="px-6 py-2 rounded-full text-sm font-semibold border-none"
              style={{ backgroundColor: btnBg, color: btnText }}
              onClick={() => {
                onProductBuy(selectedProduct);
              }}
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🔹 Otherwise → show GRID of products
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
      {products.map((p) => {
        const v = p.values || {};
        const name = v["Product Name"] || v.Name || "Product";
        const price = v.Price;
        const sale = v["Sale Price"];
        const img = v["Default Image"];
        const desc = v.Description || "";

        return (
          <div
            key={p._id}
            className="rounded-3xl p-4 flex flex-col gap-3 cursor-pointer"
            style={{
              backgroundColor: linkBg,
              color: linkText,
              boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
              maxWidth: "420px",
              width: "100%",
            }}
            // 🔹 click anywhere on the card to open details
            onClick={() => setSelectedProduct(p)}
          >
            {img && (
              <img
                src={img as string}
                alt={name}
                className="w-full h-40 rounded-2xl object-cover border border-black/10"
              />
            )}

            <div className="flex-1 flex flex-col gap-1">
              <div className="font-semibold text-sm">{name}</div>

              {desc && (
                <div className="text-xs opacity-90 line-clamp-3">
                  {desc}
                </div>
              )}

              {(price != null || sale != null) && (
                <div className="text-xs mt-1">
                  {sale != null && sale !== "" ? (
                    <>
                      {price != null && price !== "" && (
                        <span className="line-through mr-1">
                          ${Number(price).toFixed(2)}
                        </span>
                      )}
                      <span>${Number(sale).toFixed(2)}</span>
                    </>
                  ) : (
                    price != null &&
                    price !== "" && (
                      <span>${Number(price).toFixed(2)}</span>
                    )
                  )}
                </div>
              )}
            </div>

        <div className="mt-2 flex gap-2">
  <button
    className="px-5 py-2 rounded-full text-xs font-semibold border-none"
    style={{ backgroundColor: btnBg, color: btnText }}
    onClick={(e) => {
      e.stopPropagation();
      setSelectedProduct(p);
    }}
  >
    Buy Now
  </button>

  <button
    type="button"
    className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white/80"
    style={{ color: linkText }}
    onClick={(e) => {
      e.stopPropagation();
      onAddToCart(p);     // 🛒 NEW
    }}
  >
    + Cart
  </button>
</div>
          </div>
        );
      })}
    </div>
  );
}
