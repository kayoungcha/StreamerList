import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, tap, catchError, concatMap, toArray } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private apiKey = 'AIzaSyBX4NoQiGym_kybjZYyG4HyYhdlT4Kk4YY'; // 🔹 YouTube API Key 입력
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private activeRequests = new Set<string>(); // 🔹 중복 요청 방지
  private cache = new Map<string, { data: any; timestamp: number }>(); // 🔹 메모리 캐싱 (백업용)

  constructor(private http: HttpClient) {}

  /**
   * 🔹 여러 개의 키워드(배열)로 YouTube 검색 (캐싱 및 최적화 적용)
   * @param keywords 검색할 채널 이름 배열
   * @returns Observable (채널 목록)
   */
  searchYouTube(keywords: string[]): Observable<any[]> {
    if (!keywords || keywords.length === 0) return of([]); // 🔹 빈 배열이면 요청 안 함

    return from(keywords).pipe(
      concatMap((keyword) => this.getVideoFromCacheOrAPI(keyword)), // ✅ 순차적으로 API 호출
      toArray(), // ✅ 모든 결과를 하나의 배열로 변환
      map((results) => results.flat()) // ✅ 중첩 배열을 평탄화
    );
  }

  /**
   * 🔹 캐싱 확인 후 API 요청 실행
   */
  private getVideoFromCacheOrAPI(keyword: string): Observable<any[]> {
    // ✅ sessionStorage에서 캐시 확인
    const cachedData = sessionStorage.getItem(`youtube_${keyword}`);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      const now = Date.now();

      // ✅ 6시간 이내 데이터면 캐시 사용
      if (now - parsedData.timestamp <= 6 * 60 * 60 * 1000) {
        console.log(`📌 캐시된 데이터 사용: ${keyword}`);
        return of(parsedData.data);
      }
    }

    // ✅ API 중복 요청 방지
    if (this.activeRequests.has(keyword)) {
      console.log(`🚫 중복 요청 방지: ${keyword}`);
      return of([]);
    }
    this.activeRequests.add(keyword);

    // ✅ API 요청
    return this.http
      .get(`${this.apiUrl}/search`, {
        params: {
          part: 'snippet',
          q: keyword,
          type: 'video', // ✅ 검색 결과를 영상(video)으로 설정
          maxResults: '3',
          key: this.apiKey,
        },
      })
      .pipe(
        map((response: any) => {
          console.log(`📌 API 호출: ${keyword}`, response);
          return response.items.map((item: any) => ({
            videoId: item.id.videoId, // ✅ videoId 추가
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            videoImageUrl: item.snippet.thumbnails?.default?.url,
            videoTitle: item.snippet.title,
          }));
        }),
        tap((videos) => {
          // ✅ sessionStorage에 캐싱
          sessionStorage.setItem(
            `youtube_${keyword}`,
            JSON.stringify({ data: videos, timestamp: Date.now() })
          );
          this.activeRequests.delete(keyword);
        }),
        catchError((error) => {
          console.error(`⚠️ YouTube API 검색 오류 (${keyword}):`, error);
          this.activeRequests.delete(keyword);
          return of([]);
        })
      );
  }
}
