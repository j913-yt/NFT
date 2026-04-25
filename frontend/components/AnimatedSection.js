"use client";

import { motion } from "framer-motion";

export default function AnimatedSection({ children, className = "", delay = 0 }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.38, delay, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true, margin: "-80px" }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.section>
  );
}
