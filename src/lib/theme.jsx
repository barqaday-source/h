import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "jawk-theme";
const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

/** مزود الوضع الداكن/الفاتح — الداكن هو الأساسي. */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
