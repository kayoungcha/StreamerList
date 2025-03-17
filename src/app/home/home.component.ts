import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FirebaseDbService } from '../services/firebase-db.service';
import {
  Observable,
  Subject,
  take,
  takeUntil,
  of,
  tap,
  map,
  catchError,
  forkJoin,
  lastValueFrom,
  firstValueFrom,
} from 'rxjs';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { YoutubeService } from '../services/youtube.service';

interface Item {
  id: string;
  name: string;
  createdAt: number;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private dbService = inject(FirebaseDbService);
  private unsubscribe$ = new Subject<void>();
  private youtubeService = inject(YoutubeService);

  items$: Observable<any[]> = of([]);
  hasMore$: Observable<boolean> | undefined;
  videos$: Observable<any[]> | undefined;

  items: any[] = [];
  isLoading: boolean = false;
  myLikeStreamer: any;
  myRecommendVideo: any;

  private apiKey = 'AIzaSyBX4NoQiGym_kybjZYyG4HyYhdlT4Kk4YY';
  private apiUrl = 'https://www.googleapis.com/youtube/v3';
  private cache = new Map<string, { data: any; timestamp: number }>(); // 🔹 6시간 캐싱
  private activeRequests = new Set<string>(); // 🔹 중복 요청 방지

  @ViewChild('scrollAnchor', { static: false }) scrollAnchor!: ElementRef; // 🔹 감지할 요소

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    this.items$ = this.dbService.getInitialItems<any>('streamers');
    this.hasMore$ = this.dbService.hasMore();

    this.items$.pipe(takeUntil(this.unsubscribe$)).subscribe((data) => {
      this.items = data;
    });

    this.myLikeStreamer = await firstValueFrom(this.items$);
    console.log(
      'this.myLikeStreamer.splice(0, 3)',
      this.myLikeStreamer.slice(0, 3)
    );

    const myFavName = this.myLikeStreamer
      .splice(0, 3)
      .map((ele: any) => ele.channelName);

    console.log({ myFavName });
    const myFavTags = this.myLikeStreamer
      .splice(0, 3)
      .map((ele: any) => ele.tags);

    console.log({ myFavTags });

    let searchArr = [...myFavName, ...myFavTags].flat();
    console.log({ searchArr });

    this.myRecommendVideo = await this.searchYouTube(searchArr);
  }

  /**
   * 🔹 "더보기" 버튼 클릭 시 추가 데이터 로드
   */
  loadMore() {
    if (this.isLoading) return; // ✅ 중복 요청 방지
    this.isLoading = true;

    this.dbService
      .getMoreItems('streamers')
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((data: any) => {
        console.log('📌 추가 데이터:', data);
        if (!data || data.length === 0) {
          console.warn('⚠️ 추가 데이터가 없습니다.');
          return;
        }

        this.items = [...this.items, ...data];
        this.isLoading = false;
      });
  }

  /**
   * 🔹 여러 개의 키워드(배열)로 YouTube 검색
   * @param keywords 검색할 채널 이름 배열
   * @returns Observable (채널 목록)
   */
  // searchYouTube(keywords: string[]): Observable<any[]> {
  //   if (!keywords || keywords.length === 0) return of([]); // 🔹 빈 배열이면 요청 안 함

  //   const requests: Observable<any>[] = [];

  //   for (const keyword of keywords) {
  //     // ✅ 캐싱 확인 (6시간 이내 데이터면 캐시 사용)
  //     const cacheData = this.cache.get(keyword);
  //     const now = Date.now();
  //     if (cacheData && now - cacheData.timestamp <= 6 * 60 * 60 * 1000) {
  //       requests.push(of(cacheData.data)); // ✅ 캐싱된 데이터 사용
  //       continue;
  //     }

  //     if (this.activeRequests.has(keyword)) {
  //       requests.push(of([])); // ✅ 중복 요청 방지
  //       continue;
  //     }
  //     this.activeRequests.add(keyword);

  //     // ✅ API 요청 Observable 추가
  //     const request = this.http
  //       .get(`${this.apiUrl}/search`, {
  //         params: {
  //           part: 'snippet',
  //           q: keyword,
  //           type: 'video',
  //           maxResults: '3',
  //           key: this.apiKey,
  //         },
  //       })
  //       .pipe(
  //         map((response: any) => {
  //           return response.items.map((item: any) => ({
  //             videoId: item.id.videoId, // ✅ videoId 추가
  //             channelId: item.channelId,
  //             channelTitle: item.snippet.channelTitle,
  //             videoImageUrl: item.snippet.thumbnails?.default?.url,
  //             videoTitle: item.snippet.title,
  //           }));
  //         }),
  //         tap((channels) => {
  //           this.cache.set(keyword, { data: channels, timestamp: Date.now() }); // ✅ 캐싱 저장
  //           this.activeRequests.delete(keyword);
  //         }),
  //         catchError((error) => {
  //           console.error(`⚠️ YouTube API 검색 오류 (${keyword}):`, error);
  //           this.activeRequests.delete(keyword);
  //           return of([]);
  //         })
  //       );

  //     requests.push(request);
  //   }

  //   // ✅ 모든 요청을 병렬 실행 (forkJoin 사용)
  //   return forkJoin(requests).pipe(
  //     map((results) => results.flat()) // ✅ 결과를 하나의 배열로 합치기
  //   );
  // }

  trackByFn(index: number, item: any): string {
    return item.channelId; // ✅ 고유한 채널 ID를 기반으로 트래킹
  }

  async searchYouTube(keywords: string[]) {
    this.videos$ = this.youtubeService.searchYouTube(keywords);

    return await lastValueFrom(this.videos$);
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
