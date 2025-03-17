import { Injectable, NgZone, inject } from '@angular/core';
import {
  Firestore,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  FirestoreDataConverter,
  CollectionReference,
  collection,
  collectionData,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  WithFieldValue,
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FirebaseDbService {
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone); // ✅ NgZone 주입
  private lastDoc: any = null;
  public limitSize = 50;
  private hasMoreData = new BehaviorSubject<boolean>(true);
  // ✅ 동적으로 Firestore 컬렉션을 가져오는 함수
  private getCollection<T>(collectionName: string) {
    return collection(this.firestore, collectionName); // ✅ Firestore 인스턴스 활용
  }
  // ✅ Firestore에 데이터 추가
  async addItem<T extends DocumentData>(
    collectionName: string,
    item: T & { id: string }
  ): Promise<void> {
    const itemDoc = doc(this.getCollection<T>(collectionName), item.id);
    await setDoc(itemDoc, item);
  }

  // ✅ Firestore 데이터 삭제
  async deleteItem(collectionName: string, id: string): Promise<void> {
    const itemDoc = doc(this.getCollection<any>(collectionName), id);
    await deleteDoc(itemDoc);
  }

  /**
   * 🔹 특정 컬렉션에서 최초 데이터 로드
   * @param collectionName 컬렉션 이름
   * @returns 아이템 목록을 Observable로 반환
   */

  getInitialItems<T>(collectionName: string): Observable<T[]> {
    const collectionRef = collection(this.firestore, collectionName);
    const q = query(
      collectionRef,
      orderBy('concurrentUserCount', 'desc'),
      limit(this.limitSize)
    );

    return from(
      this.ngZone.runOutsideAngular(() => getDocs(q)) // ✅ Angular Zone 밖에서 실행
    ).pipe(
      map((snapshot) => {
        const items: any[] = snapshot.docs.map((doc) => doc.data());

        if (items.length > 0) {
          this.lastDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
          this.lastDoc = null;
        }

        this.hasMoreData.next(items.length === this.limitSize);
        return items;
      })
    );
  }

  getMoreItems<T>(collectionName: string): Observable<T[]> {
    console.log('📌 getMoreItems 실행:', collectionName);
    console.log('📌 현재 this.lastDoc:', this.lastDoc);

    if (!this.lastDoc) {
      console.warn(
        '⚠️ lastDoc이 null이므로 더 이상 데이터를 가져오지 않습니다.'
      );
      return of([]);
    }

    const collectionRef = collection(this.firestore, collectionName);
    const q = query(
      collectionRef,
      orderBy('concurrentUserCount', 'desc'),
      startAfter(this.lastDoc),
      limit(this.limitSize)
    );

    return from(
      this.ngZone.runOutsideAngular(() => getDocs(q)) // ✅ Angular Zone 밖에서 실행
    ).pipe(
      map((snapshot) => {
        console.log('📌 추가 데이터 snapshot:', snapshot);
        const items: any[] = snapshot.docs.map((doc) => doc.data());

        if (items.length > 0) {
          this.lastDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
          this.lastDoc = null;
        }

        this.hasMoreData.next(items.length === this.limitSize);
        return items;
      })
    );
  }

  hasMore(): Observable<boolean> {
    return this.hasMoreData.asObservable();
  }
}
