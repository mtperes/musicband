import React, { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  animate,
} from "framer-motion";

function scrollTo(target: string) {
  const element = document.getElementById(target);
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
}

const ITEMS = [
  { id: "bio", label: "O Cardume" },
  { id: "calendar", label: "Calendário" },
  { id: "socials", label: "Socials" },
  { id: "events", label: "Eventos" },
  { id: "contact", label: "Contato" },
];

const Menu: React.FC = () => {
  const COLORS_TOP = ["#13FFAA69", "#e4530069", "#DD335C69"];
  const color = useMotionValue(COLORS_TOP[0]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    animate(color, COLORS_TOP, {
      ease: "easeInOut",
      duration: 10,
      repeat: Infinity,
      repeatType: "mirror",
                               
    });
  }, []);

  const backgroundImage = useMotionTemplate`radial-gradient( ellipse farthest-corner at 10px 50%,  ${color} 20%, #ffffff05 60%)`;

  // Responsive breakpoint detection (mobile < 768px)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const hoverAnimation = isMobile
    ? { scale: 1.05, x: 5, opacity: 1 }
    : { scale: 1.19, x: 20, opacity: 1 };

  const tapAnimation = isMobile
    ? { scale: 1.1, x: 3 }
    : { scale: 1.285, x: 10 };

  const handleNavigate = (id: string) => {
    setIsOpen(false);
    scrollTo(id);
  };

  const styles = {
    button: {
      backgroundColor: "transparent",
      border: "none",
      fontFamily: "Cubano, sans-serif",
    },
  };

  return (
    <div ref={menuRef} className="contents">
      {/* Mobile: icon toggle button */}
      <motion.button
        type="button"
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isOpen}
        aria-controls="main-menu"
        onClick={() => setIsOpen((v) => !v)}
        whileTap={{ scale: 0.9 }}
        className="md:hidden fixed right-4 top-4 z-[10] flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md"
        style={{ ...styles.button, color: "#ffffff" }}
      >
        <span className="relative block h-4 w-6">
          <span
            className="absolute left-0 block h-0.5 w-6 rounded-full bg-current transition-transform duration-300"
            style={{
              top: isOpen ? "7px" : "0px",
              transform: isOpen ? "rotate(45deg)" : "none",
            }}
          />
          <span
            className="absolute left-0 top-[7px] block h-0.5 w-6 rounded-full bg-current transition-opacity duration-200"
            style={{ opacity: isOpen ? 0 : 1 }}
          />
          <span
            className="absolute left-0 block h-0.5 w-6 rounded-full bg-current transition-transform duration-300"
            style={{
              top: isOpen ? "7px" : "14px",
              transform: isOpen ? "rotate(-45deg)" : "none",
            }}
          />
        </span>
      </motion.button>

      {/* Mobile: dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="mobile-dropdown"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden fixed right-4 top-[4.5rem] z-[105] min-w-[12rem] overflow-hidden rounded-3xl border border-white/20 bg-sky-500/15  shadow-2xl backdrop-blur-xl"
            style={{ backgroundImage }}
          >
            <ul id="main-menu" className="menu flex flex-col items-stretch gap-1">
              {ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    style={styles.button}
                    onClick={() => handleNavigate(item.id)}
                    className="w-full rounded-2xl px-4 py-3 text-left text-sm text-(--primary-color) transition-colors hover:bg-white/10 active:bg-white/20 md:text-lg"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop: horizontal menu */}
      <motion.ul
        className="menu fixed left-0 pl-40 top-[6vh] hidden flex-row items-center gap-2 p-6 md:flex md:max-w-[100vw]"
        style={{ backgroundImage, backgroundPosition: "top left", zIndex: 100 }}
      >
        {ITEMS.map((item) => (
          <motion.li
            key={item.id}
            whileHover={hoverAnimation}
            whileTap={tapAnimation}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <button
              style={styles.button}
              onClick={() => handleNavigate(item.id)}
              className=" m-3 text-(--primary-color) text-sm md:text-base lg:text-xl"
            >
              {item.label}
            </button>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
};

export default Menu;