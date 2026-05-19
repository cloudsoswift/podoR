import MainBanner from "@/components/home/MainBanner";
import MiniBannerCards from "@/components/home/MiniBannerCards";
import GenreRanking from "@/components/home/GenreRanking";
import DealsSection from "@/components/home/DealsSection";

export default function Home() {
  return (
    <div className="space-y-12">
      <MainBanner />
      <MiniBannerCards />
      <GenreRanking />
      <DealsSection />
    </div>
  );
}
