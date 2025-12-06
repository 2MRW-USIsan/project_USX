"use client";

import { useRouter } from "next/navigation";
export default function MainPage() {
  const router = useRouter();
  return (
    <html>
      <body>
        <div>
          <button
            onClick={() => router.push("/game")}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Game Start
          </button>
        </div>
      </body>
    </html>
  );
}
