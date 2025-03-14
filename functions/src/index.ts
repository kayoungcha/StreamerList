import axios from 'axios';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';

const CHZZK_API_URL = 'https://openapi.chzzk.naver.com/open/v1/lives';
const CLIENT_ID = 'fa0d95e5-8b00-4fce-a3cb-c2f694fdf7cd';
const CLIENT_SECRET = 'stVXq9XroYhofMfgfvHTYuKK25GXlxjPexhU3-jPRuw';

initializeApp();
const db = getFirestore();

// ✅ 치지직 API 응답 데이터 타입 정의
interface LiveStream {
  liveId: number;
  liveTitle: string;
  liveThumbnailImageUrl: string;
  concurrentUserCount: number;
  openDate: string;
  adult: boolean;
  tags: string[];
  categoryType: string;
  liveCategory: string;
  liveCategoryValue: string;
  channelId: string;
  channelName: string;
  channelImageUrl: string;
}

interface ApiResponse {
  data: LiveStream[];
  page?: { next?: string };
}

// ✅ 2시간마다 자동 실행 (원래 스케줄)
export const fetchAndStoreChannels = onSchedule(
  { schedule: 'every 120 minutes', region: 'asia-northeast3' },
  async () => {
    await fetchChannels();
  }
);

// ✅ 지금 바로 실행할 수 있는 HTTP 함수 추가 (수동 실행)
export const fetchAndStoreChannelsNow = onRequest(
  { region: 'asia-northeast3' },
  async (req, res) => {
    try {
      console.log('🔥 즉시 실행: 치지직 채널 정보를 Firestore에 저장 시작...');
      await fetchChannels();
      res.status(200).send('✅ fetchAndStoreChannels 실행 완료!!!!');
    } catch (error) {
      console.error('❌ 즉시 실행 중 오류 발생:', error);
      res.status(500).send('❌ 실행 중 오류 발생!');
    }
  }
);

// ✅ 치지직 API 데이터 가져오기 (공통 함수)
async function fetchChannels() {
  console.log('🔥 치지직 API 호출 시작...');
  let nextPageToken: string | null = null;
  let channelCount = 0;
  const MAX_PAGES = 100;
  const PAGE_SIZE = 20;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const response = await axios.get(CHZZK_API_URL, {
        params: { size: PAGE_SIZE, next: nextPageToken },
        headers: {
          'Cache-Control': 'no-cache',
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Client-Id': CLIENT_ID,
          'Client-Secret': CLIENT_SECRET,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5초 타임아웃
      });

      console.log('📌 API 응답 데이터:', response.data);

      if (
        !response.data ||
        !response.data.content ||
        !response.data.content.data
      ) {
        console.error('❌ API 응답이 올바르지 않습니다:', response.data);
        break; // 비정상적인 응답이면 중단
      }

      // ✅ 여기서 `content`를 먼저 추출해야 함
      const { content } = response.data as { content: ApiResponse };
      const { data, page } = content;

      nextPageToken = page?.next || null;

      if (!data.length) {
        console.log('✅ 더 이상 불러올 데이터가 없습니다. 중단합니다.');
        break;
      }

      for (const live of data) {
        if (live.categoryType !== 'GAME') continue; // ✅ categoryType이 GAME인 것만 저장
        const channelRef = db.collection('streamers').doc(live.channelId);

        try {
          await channelRef.set(
            {
              ...live,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          channelCount++; // ✅ Firestore에 저장된 경우만 증가
        } catch (error) {
          console.error(`❌ Firestore 저장 실패: ${live.channelName}`, error);
        }
      }

      console.log(
        `✅ ${data.length}개 중 ${channelCount}개 채널 저장 완료 (누적)`
      );

      if (!nextPageToken) {
        console.log('✅ 다음 페이지 토큰이 없으므로 데이터 수집을 종료합니다.');
        break;
      }
    }
    console.log('🔥 모든 채널 정보 저장 완료!');
  } catch (error) {
    console.error('❌ 치지직 API 호출 오류:', error);
  }
}
