import VenueList from "@/components/venue/VenueList";
import { Venue } from "@/components/venue/VenueCard";

const placeholderVenues: Venue[] = [
  {
    seq: 1,
    name: "올림픽공원 KSPO돔",
    address: "서울특별시 송파구 올림픽로 424",
    description: "국내 최대 규모의 실내 공연장으로, 약 15,000석 규모를 보유하고 있습니다.",
    venueImage: null,
  },
  {
    seq: 2,
    name: "잠실종합운동장",
    address: "서울특별시 송파구 올림픽로 25",
    description: "서울을 대표하는 대형 야외 공연장입니다.",
    venueImage: null,
  },
];

export default function VenuesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">공연장</h1>
      <VenueList venues={placeholderVenues} />
    </div>
  );
}
