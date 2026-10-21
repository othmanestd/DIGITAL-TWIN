// The JABB "J" mark (white by default), shared by the top bar and the sign-in pages.
export function JabbMark({ size = 18, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 196 291" height={size} width={(size * 196) / 291} fill={color} aria-hidden>
      <path d="M151.5,193.8c0,18.4-3.8,33-11.5,43.9c-7.6,10.9-21.6,16.4-41.8,16.4c-10.9,0-19.9-1.6-26.9-4.9s-12.5-7.9-16.4-13.8c-3.9-5.9-6.6-12.9-8.2-21c-1.6-8.1-2.3-17-2.3-26.6v-14H0v20.6c0,31.8,8.4,55.9,25.2,72.2c16.8,16.4,40.8,24.5,72,24.5c18.7,0,34.4-2.6,47-7.7c12.6-5.1,22.7-12,30.4-20.6c7.6-8.6,13.1-18.3,16.4-29.2c3.3-10.9,4.9-22,4.9-33.2v-27.1h-44.4V193.8z" />
      <polygon points="151.5,27 151.5,149.3 195.9,149.3 195.9,0" />
      <circle cx="32.7" cy="52" r="25" />
    </svg>
  );
}
