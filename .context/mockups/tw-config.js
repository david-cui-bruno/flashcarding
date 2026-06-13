/**
 * tw-config.js — Tailwind CDN config for Carding mockups
 *
 * Loaded via: <script src="tw-config.js"></script>
 * Must come AFTER the Tailwind CDN <script> tag.
 *
 * Bridges the CSS custom-property design tokens (defined in theme.css)
 * into Tailwind utility classes so mockups can freely mix Tailwind
 * helpers with component classes without naming conflicts.
 */

tailwind.config = {
  /* Disable Tailwind's own dark-mode class strategy — we use the
     @media prefers-color-scheme approach defined in theme.css. */
  darkMode: "media",

  theme: {
    extend: {
      colors: {
        /* ── Semantic surface tokens ── */
        bg:       "var(--bg)",
        card:     "var(--card)",
        border:   "var(--border)",
        input:    "var(--input)",

        /* ── Foreground tokens ── */
        fg:       "var(--fg)",
        "muted-fg": "var(--muted-fg)",
        "soft-fg":  "var(--soft-fg)",

        /* ── Accent / primary tokens ── */
        primary:       "var(--primary)",
        "primary-hover":"var(--primary-hover)",
        "primary-fg":  "var(--primary-fg)",
        soft:          "var(--soft)",
        muted:         "var(--muted)",
        accent:        "var(--accent-color)",

        /* ── Grade / semantic state tokens ── */
        keep:   "var(--keep)",
        reject: "var(--reject)",
        warn:   "var(--warn)",
        info:   "var(--info)",

        /* ── Raw sage scale (for fine-grained control) ── */
        sage: {
          50:  "var(--sage-50)",
          100: "var(--sage-100)",
          200: "var(--sage-200)",
          300: "var(--sage-300)",
          400: "var(--sage-400)",
          500: "var(--sage-500)",
          600: "var(--sage-600)",
          700: "var(--sage-700)",
          800: "var(--sage-800)",
          900: "var(--sage-900)",
        },

        /* ── Raw warm-neutral scale ── */
        base: {
          0:   "var(--base-0)",
          50:  "var(--base-50)",
          100: "var(--base-100)",
          200: "var(--base-200)",
          300: "var(--base-300)",
          400: "var(--base-400)",
          500: "var(--base-500)",
          600: "var(--base-600)",
          700: "var(--base-700)",
          800: "var(--base-800)",
          900: "var(--base-900)",
          950: "var(--base-950)",
        },
      },

      borderRadius: {
        DEFAULT: "var(--radius)",
        card:    "var(--radius)",
        pill:    "9999px",
      },

      boxShadow: {
        card:   "var(--shadow)",
        "card-md": "var(--shadow-md)",
      },

      ringColor: {
        DEFAULT: "var(--ring)",
      },
    },
  },

  plugins: [],
};
