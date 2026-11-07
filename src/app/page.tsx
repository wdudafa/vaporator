import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">

          main page type :shit
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            <a href="/harry">Harry's Steam Profile</a>
          </button>
          </div>
      </main>
    </div>
  );
}
