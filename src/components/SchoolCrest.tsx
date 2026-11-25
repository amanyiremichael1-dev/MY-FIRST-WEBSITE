interface SchoolCrestProps {
  className?: string;
}

export function SchoolCrest({ className = 'h-10 w-10' }: SchoolCrestProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Alliance Vocational School Ibanda Crest"
    >
      <path
        d="M32 4L8 13V31C8 45.8 18.2 56.8 32 60C45.8 56.8 56 45.8 56 31V13L32 4Z"
        fill="#0B1F3A"
        stroke="#60A5FA"
        strokeWidth="2.2"
      />
      <path
        d="M32 9L13 16.2V31C13 42.6 21 51.3 32 54.2C43 51.3 51 42.6 51 31V16.2L32 9Z"
        fill="#13345E"
      />
      <circle cx="32" cy="31" r="11" stroke="#93C5FD" strokeWidth="2" strokeDasharray="3 2" />
      <path
        d="M21 36C24.5 34.2 28.5 34.2 32 36C35.5 34.2 39.5 34.2 43 36V25C39.5 23.2 35.5 23.2 32 25C28.5 23.2 24.5 23.2 21 25V36Z"
        fill="#FFFFFF"
      />
      <path d="M32 25V36" stroke="#13345E" strokeWidth="1.8" />
      <path
        d="M32 14L34.4 19.6H29.6L32 14Z"
        fill="#FBBF24"
      />
    </svg>
  );
}
