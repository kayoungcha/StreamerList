import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FirebaseDbService } from '../services/firebase-db.service';
import { Observable, Subject, take, takeUntil, of } from 'rxjs';
import { CommonModule } from '@angular/common';
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

  items$: Observable<any[]> = of([]);
  hasMore$: Observable<boolean> | undefined;
  items: any[] = [];
  isLoading: boolean = false;

  @ViewChild('scrollAnchor', { static: false }) scrollAnchor!: ElementRef; // 🔹 감지할 요소

  constructor() {}

  ngOnInit() {
    this.items$ = this.dbService.getInitialItems<any>('streamers');
    this.hasMore$ = this.dbService.hasMore();

    this.items$.pipe(takeUntil(this.unsubscribe$)).subscribe((data) => {
      this.items = data;
    });
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

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
