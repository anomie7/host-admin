# 🏨 Host Admin — Warm Stay

개인 숙소 호스트를 위한 관리자 대시보드 데모입니다.
에어비앤비, 부킹닷컴, 리브애니웨어 등에 숙소를 등록한 호스트가 사용할 수 있는 도구입니다.

## 기능

- 📊 **대시보드** — 월별 수익, 점유율, 오늘의 체크인/체크아웃, 플랫폼별 수익 차트
- 🏠 **숙소 관리** — 숙소 등록/수정/삭제, 사진 업로드, 플랫폼 토글
- 📅 **캘린더** — 월간 예약 현황, 색상코드 상태 표시, 예약 상세 모달, 상태 변경
- 📋 **알림 배너** — 오늘의 체크인/체크아웃/정산 요약
- 📎 **CSV 내보내기** — 예약 데이터 엑셀 다운로드

## 기술 스택

| 계층 | 기술 |
|:----:|:----:|
| 프론트 | React 18 + Vite + react-router-dom |
| 백엔드 | Express.js |
| DB | SQLite (better-sqlite3) |
| 디자인 | Warm Stay — 웜 화이트/코랄/틸 |

## 로컬 실행

```bash
npm install
npm run build    # 프론트 빌드
npm start        # http://localhost:4001
```

또는 개발 모드:
```bash
npm run dev      # Express(4001) + Vite(5173) 동시 실행
```

## Railway 배포

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/...)

### 수동 배포

1. GitHub에 레포지토리 생성 후 push:

```bash
cd host-admin
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/사용자명/host-admin.git
git push -u origin main
```

2. [Railway.app](https://railway.app) 접속 → **New Project** → **Deploy from GitHub repo**

3. **Build Command:** (자동 감지됩니다)
```
npm run build
```

4. **Start Command:**
```
npm start
```

5. 배포 완료! `https://host-admin.up.railway.app/`

> 데이터는 배포 시 매번 새로 생성됩니다 (demo용). 실제 사용 시 Persistent Volume 설정이 필요합니다.

## 라이선스

MIT — 데모 목적으로 자유롭게 사용하세요.
