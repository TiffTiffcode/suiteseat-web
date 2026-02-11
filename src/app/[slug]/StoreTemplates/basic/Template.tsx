//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\app\[slug]\StoreTemplates\basic\Template.tsx
"use client";

import React from "react";
import { useFlow } from "../../StoreFlows/basicFlow";

import new1 from "./assets/new-1.png";
import serumImg from "./assets/serum.png";
import maskImg from "./assets/mask.png";
import conditionerImg from "./assets/conditioner.png";
import promo1 from "./assets/123.png";
import tile1 from "./assets/serum.png";
import tile2 from "./assets/45.png";
import tile3 from "./assets/46.png";
import tile4 from "./assets/44.png";

/* =========================
   WIDE MEDIA (ONLY ONCE)
========================= */
type WideMediaItem = { src: string; alt?: string };

function WideMedia({ items }: { items: WideMediaItem[] }) {
  const slides = items || [];
  const hasMany = slides.length > 1;

  const [idx, setIdx] = React.useState<number>(0);

  React.useEffect(() => {
    if (idx > slides.length - 1) setIdx(0);
  }, [slides.length, idx]);

  React.useEffect(() => {
    if (!hasMany) return;
    const t = window.setInterval(() => {
      setIdx((i: number) => (i + 1) % slides.length);
    }, 3000);
    return () => window.clearInterval(t);
  }, [hasMany, slides.length]);

  const goPrev = () => setIdx((i: number) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setIdx((i: number) => (i + 1) % slides.length);

  if (slides.length === 0) return <div className="wideMediaPlaceholder">Image / Slider</div>;

  if (!hasMany) {
    return <img className="wideMediaImg" src={slides[0].src} alt={slides[0].alt || "Featured"} />;
  }

  return (
    <>
      <div className="wideMediaTrack" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {slides.map((s, i) => (
          <div className="wideMediaSlide" key={i}>
            <img className="wideMediaImg" src={s.src} alt={s.alt || `Slide ${i + 1}`} />
          </div>
        ))}
      </div>

      <button className="wideMediaBtn wideMediaBtnLeft" type="button" onClick={goPrev} aria-label="Previous">
        ‹
      </button>
      <button className="wideMediaBtn wideMediaBtnRight" type="button" onClick={goNext} aria-label="Next">
        ›
      </button>
    </>
  );
}

/* =========================
   PANEL ACCORDION
========================= */
function PanelAccordion() {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  const items = [
    { key: "instructions", label: "Instructions", icon: "📖", body: "Put your instructions text here..." },
    { key: "ingredients", label: "Ingredients", icon: "🧴", body: "Put your ingredients text here..." },
    { key: "shipping", label: "Shipping", icon: "🚚", body: "Put your shipping text here..." },
  ];

  return (
    <div className="panelAccordion" aria-label="More info">
      {items.map((it) => {
        const isOpen = openKey === it.key;
        return (
          <div key={it.key} className={`accItem ${isOpen ? "isOpen" : ""}`}>
            <button
              type="button"
              className="accHeader"
              aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : it.key)}
            >
              <span className="accLeft">
                <span className="accIcon" aria-hidden="true">
                  {it.icon}
                </span>
                <span className="accLabel">{it.label}</span>
              </span>
              <span className="accChevron" aria-hidden="true">
                {isOpen ? "▾" : "▸"}
              </span>
            </button>

            {isOpen && <div className="accBody">{it.body}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function BasicTemplate({ store, products, slug }: any) {
  const name = store?.values?.Name || slug;
  const heroImg = "/qassets/placeholders/hero-elmajor.png";
  const { startBuyNow } = useFlow();

  /* =========================
     STATE (MUST BE ABOVE openProduct)
  ========================= */
  const [isProductOpen, setIsProductOpen] = React.useState(false);
  const [activeImg, setActiveImg] = React.useState<string | null>(null);

  /* =========================
     GALLERY
  ========================= */
  const gallery = [
    { src: tile1.src, alt: "Product image 1" },
    { src: tile2.src, alt: "Product image 2" },
    { src: tile3.src, alt: "Product image 3" },
    { src: tile4.src, alt: "Product image 4" },
  ];

  /* =========================
     OPEN PRODUCT (when a card is clicked)
  ========================= */
const openProduct = (card: any) => {
  setIsProductOpen(true);
  setActiveImg(null);
};



///////
//helper for page scroll to top 
React.useEffect(() => {
  if (!isProductOpen) return;

  // wait until the DOM updates
  requestAnimationFrame(() => {
    // works in more browsers than only window.scrollTo
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  });
}, [isProductOpen]);



return (
  <div className="storePage">



    {/* ////////////////////////////////////////////
                            TOP CTA BAR (announcement)                    */}
                 
      {/* TOP CTA BAR */}
      <section className="topCtaBar" aria-label="Announcement">
        <div className="topCtaInner">
          <span className="topCtaText">Add your announcement text here</span>
        </div>
      </section>



    {/* ////////////////////////////////////////////
                              HEADER                                        */}
  <header className="storeHeader">
        <div className="storeHeaderInner">
          <div className="storeHeaderLeft">
            <a className="storeLogo" href={`/${slug}`}>
              {name}
            </a>
          </div>

          <nav className="storeHeaderNav" aria-label="Store navigation">
            <a className="storeTab" href="#products">
              Shop
            </a>
            <a className="storeTab" href="#about">
              About
            </a>
            <a className="storeTab" href="#contact">
              Contact
            </a>
          </nav>

          <div className="storeHeaderRight">
            <button className="cartBtn" type="button" aria-label="Open cart">
              <span className="cartIcon" aria-hidden="true">
                🛒
              </span>
              <span className="cartLabel">Cart</span>
              <span className="cartCount">0</span>
            </button>
          </div>
        </div>
      </header>

    {/* ////////////////////////////////////////////
                            Hero                                   */}
 {/* ✅ HIDE THESE WHEN PRODUCT IS OPEN */}
      {!isProductOpen && (
        <>
          {/* HERO */}
          <section className="storeHero" aria-label="Hero">
            <div className="heroGrid">
              <div className="heroText">
                <div className="heroCard">
                  <div className="heroKicker">Its Your Time</div>

                  <h1 className="heroHeadline">
                    <span>Perfect Ingredients</span>
                    <span>to Grow lustrious</span>
                    <span>hair today</span>
                  </h1>

                  <div className="heroActions">
                    <button className="heroBtn" type="button">
                      Shop Now
                    </button>
                  </div>
                </div>
              </div>

              <div className="heroMedia">
                {heroImg ? (
                  <img className="heroMediaImg" src={heroImg} alt={`${name} hero`} />
                ) : (
                  <div className="heroMediaBox">Image or video</div>
                )}
              </div>
            </div>
          </section>



    {/* ////////////////////////////////////////////
                           CATEGORY STRIP SECTION                               */}
{/* CATEGORY STRIP (under hero) */}
  <section className="categoryStrip" aria-label="Collections">
            <div className="categoryStripInner">
              <a className="categoryPill" href="#collection-1">
                Shampoo
              </a>
              <a className="categoryPill" href="#collection-2">
                Conditioner
              </a>
              <a className="categoryPill" href="#collection-3">
                Serum
              </a>
              <a className="categoryPill" href="#collection-4">
                Mask
              </a>
            </div>
          </section>


{/* ////////////////////////////////////////////
                     NEW ARRIVALS SECTION
//////////////////////////////////////////////// */}

    <section className="featuredSection" aria-label="Featured sections">
            <div className="featuredInnerBox">
              <div className="featuredInner">
                <h2 className="featuredTitle">New Arrivals</h2>
              </div>

              {(() => {
                const featuredCards = [
                  { img: "/qassets/placeholders/shampooo.png", name: "Revitalizing Shampoo", sub: "$17" },
                  { img: conditionerImg.src, name: "Revitalizing Conditioner", sub: "$17" },
                  { img: serumImg.src, name: "Silkening Serum", sub: "$28" },
                  { img: maskImg.src, name: "Moisturizing Mask", sub: "$26" },
                ];

                return (
                  <div className="featuredGrid">
                    {featuredCards.map((card, idx) => (
                      <button
                        key={idx}
                        className="featuredCard"
                        type="button"
                        onClick={() => openProduct(card)}
                        aria-label={`Open ${card.name}`}
                      >
                        <div className="featuredMedia">
                          <img className="featuredImg" src={card.img} alt={card.name} />
                        </div>

                        <div className="featuredMeta">
                          <div className="featuredName">{card.name}</div>
                          <div className="featuredSub">{card.sub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>


    {/* ////////////////////////////////////////////
                         IMAGE SLIDER SECTION
                          */}                         
{/* FULL-WIDTH IMAGE / SLIDER SECTION */}
   
    {/* Full screen image size 3500X950 is perfect*/}                         
{/* FULL-WIDTH IMAGE / SLIDER SECTION */}
  <section className="wideMedia" aria-label="Featured media">
            <div className="wideMediaFrame">
              <WideMedia
                items={[
                  { src: promo1.src, alt: "Promo 1" },
                  // add more later
                ]}
              />
            </div>
          </section>
        </>
      )}








{/* =========================
    PRODUCT DRAWER (for later)
========================= */}
{isProductOpen && (
  <>
    {/* =========================
        PRODUCT DRAWER
    ========================= */}
    <section className="productPanel isOpen" aria-label="Selected product">
<button
  type="button"
  onClick={() => {
    setIsProductOpen(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });
  }}
>
  ← Back
</button>


      <div className="productPanelInner">
        {/* LEFT */}
        <div className="productPanelLeft">
          {!activeImg ? (
            <div className="mediaGrid2x2">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  className="mediaTile"
                  type="button"
                  onClick={() => setActiveImg(img.src)}
                  aria-label={`Open ${img.alt}`}
                >
                  <div className="mediaTileImage">
                    <img className="mediaTileImg" src={img.src} alt={img.alt} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mediaSingle">
              <button
                type="button"
                className="mediaSingleClose"
                onClick={() => setActiveImg(null)}
                aria-label="Back to gallery"
              >
                ✕
              </button>

              <img
                className="mediaSingleImg"
                src={activeImg}
                alt="Selected product image"
              />
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="productPanelRight">
          <h2 className="panelTitle">Silkening Serum</h2>
          <div className="panelSub">$28</div>

          <p className="panelBody">
            smallt tex edsafe afde asdfsesdaf asdfasd
            fasdfasdfa dfadfsd fadsfavgf efvdas fesdf
            dsfdsf dsdsaf asdfdsfds fdsagv aedsf small text
          </p>

          <div className="panelButtons">
            <button className="addToCrtBtn" type="button">Add To Cart</button>
            <button className="buyNowBtn" type="button">Buy Now</button>
          </div>

          <PanelAccordion />
        </div>
      </div>
    </section>

    {/* =========================
        MORE PRODUCT INFO
    ========================= */}
    <section className="productInfoSection" aria-label="More product info">
      <h4 className="infoSub">How To Apply</h4>

      <div className="productInfoInner">
        <div className="infoCol">
          <h4 className="infoSub">Cleanse Your Hair</h4>
          <p className="infoBody">
            llmenan nsfdoijsdfoijjf joifjds<br />
            qwepoinv asdfjkl zmxncvnqwe<br />
            pldksm vnoqiwue zzzkfjwq
          </p>
        </div>

        <div className="infoCol">
          <h4 className="infoSub">Apply Oil To Scalp</h4>
          <p className="infoBody">
            llmenan nsfdoijsdfoijjf joifjds<br />
            qwepoinv asdfjkl zmxncvnqwe<br />
            pldksm vnoqiwue zzzkfjwq
          </p>
        </div>

        <div className="infoCol">
          <h4 className="infoSub">Massage Your Scalp</h4>
          <p className="infoBody">
            llmenan nsfdoijsdfoijjf joifjds<br />
            qwepoinv asdfjkl zmxncvnqwe<br />
            pldksm vnoqiwue zzzkfjwq
          </p>
        </div>
      </div>
    </section>

    {/* =========================
       ITEMS YOU MAY LIKE (match Featured)
    ========================= */}
    <section className="featuredSection recoAsFeatured" aria-label="Items you may like">
      <div className="featuredInnerBox">
        <div className="featuredInner">
          <h2 className="featuredTitle">Items You May Like</h2>
        </div>

        {(() => {
          const recoCards = [
            { href: "#reco-1", img: conditionerImg.src, name: "Revitalizing Conditioner", sub: "$17" },
            { href: "#reco-2", img: serumImg.src,       name: "Silkening Serum",        sub: "$28" },
            { href: "#reco-3", img: maskImg.src,        name: "Moisturizing Mask",      sub: "$26" },
          ];

          return (
            <div className="featuredGrid">
              {recoCards.map((card, idx) => (
                <a key={idx} className="featuredCard" href={card.href}>
                  <div className="featuredMedia">
                    <img className="featuredImg" src={card.img} alt={card.name} />
                  </div>

                  <div className="featuredMeta">
                    <div className="featuredName">{card.name}</div>
                    <div className="featuredSub">{card.sub}</div>
                  </div>
                </a>
              ))}
            </div>
          );
        })()}
      </div>
    </section>
  </>
)}





{/* =========================
    FOOTER
========================= */}
<footer className="storeFooter" id="footer">
  <div className="storeFooterInner">
    {/* Left: “logo text” */}
    <div className="storeFooterBrand">
      <div className="storeFooterLogoText">{name}</div>
    </div>

    {/* Middle: links */}
    <div className="storeFooterCols">
      <div className="storeFooterCol">
        <a className="storeFooterLink" href="#products">Shop</a>
        <a className="storeFooterLink" href="#about">About</a>
        <a className="storeFooterLink" href="#contact">Contact</a>
      </div>

      <div className="storeFooterCol">
        <a className="storeFooterLink" href="#policies">Policies</a>
        <a className="storeFooterLink" href="#shipping">Shipping</a>
        <a className="storeFooterLink" href="#returns">Returns</a>
      </div>

      <div className="storeFooterCol">
        <a className="storeFooterLink" href="#support">Support</a>
        <a className="storeFooterLink" href="#faq">FAQ</a>
        <a className="storeFooterLink" href="#email">Email</a>
      </div>
    </div>
  </div>
</footer>










    </div>
    
  );
}
