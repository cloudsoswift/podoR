import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row justify-between gap-6 text-sm text-gray-400">
        <div className="space-y-2">
          <span className="text-lg font-bold text-gray-700">podoR</span>
          <p>공연 예매의 새로운 경험</p>
        </div>
        <div className="flex gap-8">
          <div className="space-y-2">
            <p className="font-medium text-gray-600">서비스</p>
            <ul className="space-y-1">
              <li><Link href="#" className="hover:text-gray-600">공지사항</Link></li>
              <li><Link href="#" className="hover:text-gray-600">고객센터</Link></li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-gray-600">정책</p>
            <ul className="space-y-1">
              <li><Link href="#" className="hover:text-gray-600">이용약관</Link></li>
              <li><Link href="#" className="hover:text-gray-600">개인정보처리방침</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
