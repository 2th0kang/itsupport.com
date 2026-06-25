// ====================================================
// 외부 데이터베이스 연동 완료 (JSONBlob 사용 - GitHub Pages 전용)
// ====================================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxBX1Lzq3s3ue5fmPpwwoLut98wKHN1Af9rcYjw1LdaC7Z6UD51qZwKpqlm06poxFooFg/exec';

document.addEventListener('DOMContentLoaded', () => {
    // [보안/자가 복구] 기존 localStorage에 남아있던 구버전 로그인 정보 강제 청소 (sessionStorage로 이전 완료됨)
    ['itUserRole', 'itUserName', 'itUserTeam', 'itUserEmail', 'itUserLoginId', 'itUserPasswordHash'].forEach(key => localStorage.removeItem(key));

    // 권한 및 사용자 정보 상태 관리 (로컬 세션 연동 복구)
    let userRole = sessionStorage.getItem('itUserRole') || ''; 
    let isAdmin = (userRole === 'admin');
    let userLoginId = sessionStorage.getItem('itUserLoginId') || '';
    let userPasswordHash = sessionStorage.getItem('itUserPasswordHash') || '';
    
    let requests = [];
    let chatbotGuides = []; // 챗봇 가이드 동적 데이터 배열
    let attachedImages = []; // 첨부된 이미지 데이터 배열 (Base64)
    let attachedFiles = [];  // 첨부된 일반 파일 배열 [{name, mimeType, base64, url}]

    // 로딩 오버레이 제어
    const loadingOverlay = document.getElementById('loadingOverlay');
    function showLoading() { if (loadingOverlay) loadingOverlay.classList.add('show'); }
    function hideLoading() { if (loadingOverlay) loadingOverlay.classList.remove('show'); }

    // 기본 4대 챗봇 가이드 데이터
    function getDefaultGuides() {
        return [
            {
                id: 1, key: 'monitor', title: '🖥️ 모니터 화면이 안 나옴 해결법',
                steps: [
                    "전원 케이블 확인: 모니터 뒷면 및 콘센트에 전원선이 단단히 연결되었는지 확인하고 모니터를 켜보세요.",
                    "케이블 재연결: 본체와 모니터 사이의 HDMI/DP 케이블을 분리 후 다시 단단히 밀어 넣으세요.",
                    "입력 소스 전환: 모니터 버튼으로 입력 모드를 변경해 보세요.",
                    "본체 리부팅: 본체 전원 버튼을 길게 눌러 껐다가 다시 켜보세요."
                ],
                tip: "모니터 자체 화면에 '케이블 연결 확인'이 뜬다면 본체 그래픽 카드 접촉 문제일 확률이 큽니다.",
                downloads: []
            },
            {
                id: 2, key: 'printer', title: '🖨️ 프린터/인쇄 오류 해결법',
                steps: [
                    "기본 프린터 점검: 기본 인쇄 복합기가 올바르게 선택되었는지 장치 및 프린터에서 확인하세요.",
                    "대기열 초기화: 대기열이 꼬인 경우 인쇄 대기열 삭제를 클릭하여 비워 주세요.",
                    "스풀러 재시작: 아래 배치파일을 사용하여 spooler 서비스를 재시작할 수 있습니다."
                ],
                tip: "복합기 물리 액정에 에러 코드나 용지 부족 표시등이 켜져 있는지 가장 먼저 점검해보세요.",
                downloads: [{title: "프린터 스풀러 재시작", text: "🛠️ 프린터 스풀러 재시작 배치파일 다운로드", file: "downloads/restart_spooler.bat", guide: "마우스 우클릭 후 관리자 권한으로 실행해야 합니다."}]
            },
            {
                id: 3, key: 'slow', title: '⚡ PC 속도 저하 및 프로그램 오류 해결법',
                steps: [
                    "점유율 관리: Ctrl+Shift+Esc로 작업 관리자를 열고 비정상 프로세스를 작업 끝내기 하세요.",
                    "용량 비우기: C드라이브 가용 공간이 10% 이상 남았는지 확보하고 필요시 백업하십시오."
                ],
                tip: "오래 켜진 PC는 메모리 누수가 있을 수 있으므로 주기적으로 완전히 재부팅할 것을 권장합니다.",
                downloads: []
            },
            {
                id: 4, key: 'share', title: '📁 공유폴더 접속 오류 해결법',
                steps: [
                    "경로 체크: 백슬래시 기호와 서버 IP 주소가 올바른지 다시 한번 주소창을 검사하세요.",
                    "자격증명 제거: 캐시된 네트워크 로그인을 리셋 배치파일로 제거하고 재부팅 후 접근해보세요.",
                    "윈도우 11 대응: 최신 보안 사양 때문에 차단된 공유폴더의 복구 배치파일을 가이드대로 가동해보세요."
                ],
                tip: "특정 폴더만 접근 거부가 발생하면 서버 관리자의 권한 셋업 오류입니다.",
                downloads: [
                    {title: "공유폴더 자격증명 캐시 제거 (공통)", text: "🛠️ 윈도우 자격증명 초기화 배치파일 다운로드", file: "downloads/reset_share_credentials.bat", guide: "실행 완료 후 반드시 PC를 재부팅해주십시오."},
                    {title: "윈도우 11 전용 접속 오류 복구 (11번 스캔팩스 / 39번 소프트웨어 점검 서버용)", text: "🛠️ 윈도우 11 공유폴더 접속 복구 배치파일 다운로드", file: "downloads/fix_win11_share_error.bat", guide: "실행 완료 후 반드시 PC를 재부팅해주십시오."}
                ]
            }
        ];
    }

    // (GET) 구글 시트에서 데이터 불러오기
    async function loadData() {
        if (!userRole) {
            // 비로그인 상태일 때는 데이터 조회 차단
            return;
        }
        if (!GOOGLE_SCRIPT_URL) {
            console.warn('구글 스크립트 연동 해제 상태 - 로컬 데이터 모드로 동작합니다.');
            const localData = localStorage.getItem('localRequestsDB');
            if (localData) {
                const parsed = JSON.parse(localData);
                requests = parsed.requests || parsed || [];
            }
            const localGuides = localStorage.getItem('localChatbotGuidesDB');
            if (localGuides) {
                chatbotGuides = JSON.parse(localGuides);
            } else {
                chatbotGuides = getDefaultGuides();
                localStorage.setItem('localChatbotGuidesDB', JSON.stringify(chatbotGuides));
            }
            renderTable();
            renderQuickReplies();
            updateNotifications();
            return;
        }
        showLoading();
        try {
            // 보안 강화: doGet 호출 시 사용자 아이디 및 패스워드 해시를 전달
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?username=${encodeURIComponent(userLoginId)}&passwordHash=${encodeURIComponent(userPasswordHash)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    requests = data.requests || [];
                    chatbotGuides = data.chatbotGuides || [];
                    
                    // 자가 복구: 서버에서 받아온 가이드가 없거나 백엔드가 미배포 상태인 경우 로컬 캐시/기본값 적재
                    if (!chatbotGuides || chatbotGuides.length === 0) {
                        const localGuides = localStorage.getItem('localChatbotGuidesDB');
                        if (localGuides) {
                            chatbotGuides = JSON.parse(localGuides);
                        } else {
                            chatbotGuides = getDefaultGuides();
                            localStorage.setItem('localChatbotGuidesDB', JSON.stringify(chatbotGuides));
                        }
                    }

                    renderTable(); // 데이터 가져온 후 테이블 다시 그리기
                    renderQuickReplies(); // 퀵 리플라이 버튼 렌더링
                    updateNotifications(); // 알림 상태 업데이트
                } else if (data.message === 'Unauthorized') {
                    alert('세션이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.');
                    btnLogout.click();
                }
            }
        } catch (error) {
            console.error('데이터를 불러오는데 실패했습니다:', error);
            alert('데이터 로드 실패: 구글 서버와의 연결을 확인하세요.');
        } finally {
            hideLoading();
        }
    }

    // (POST) 외부 DB에 데이터 쓰기
    async function saveDataAsync() {
        if (!GOOGLE_SCRIPT_URL) {
            // 서버 대신 브라우저 로컬 스토리지에 저장하여 원활한 UI 테스트 지원
            localStorage.setItem('localRequestsDB', JSON.stringify({ requests }));
            updateDashboardKPI();
            return true;
        }
        showLoading();
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    // 구글 앱스 스크립트 CORS 이슈 방지를 위해 text/plain 사용
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({ action: 'saveRequests', requests })
            });
            if (response.ok) {
                updateDashboardKPI(); // 성공하면 KPI 수치 갱신
                return true;
            } else {
                throw new Error('Server returned ' + response.status);
            }
        } catch (error) {
            console.error('데이터 저장 실패:', error);
            alert('데이터 저장 중 네트워크 오류가 발생했습니다.');
            return false;
        } finally {
            hideLoading();
        }
    }

    // 네비게이션 및 페이지 관련 엘리먼트
    const navLinks = document.querySelectorAll('.nav-links a[data-target]');
    const pages = document.querySelectorAll('.page');
    const navItemReport = document.getElementById('nav-item-report');
    const navItemProvision = document.getElementById('nav-item-provision');
    const navItemLogin = document.getElementById('nav-item-login');
    const navItemLogout = document.getElementById('nav-item-logout');
    const navItemRequest = document.getElementById('nav-item-request');
    const navItemDashboard = document.getElementById('nav-item-dashboard');
    const navItemAdminList = document.getElementById('nav-item-admin-list');
    const navItemUserList = document.getElementById('nav-item-user-list');
    const navItemChatbotAdmin = document.getElementById('nav-item-chatbot-admin');
    const navItemChatbot = document.getElementById('nav-item-chatbot');
    const navItemAdminRegister = document.getElementById('nav-item-admin-register');
    const navUserProfile = document.getElementById('nav-user-profile');
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const navItemNotification = document.getElementById('nav-item-notification');
    const notificationBadge = document.getElementById('notification-badge');

    // 일반 사용자 로그인 시 입력 폼에 로그인 정보 자동 세팅
    function fillUserInfo() {
        if (userRole === 'user') {
            const nameVal = sessionStorage.getItem('itUserName') || '';
            const teamVal = sessionStorage.getItem('itUserTeam') || '';
            const emailVal = sessionStorage.getItem('itUserEmail') || '';
            
            const reqNameEl = document.getElementById('reqName');
            const reqTeamEl = document.getElementById('reqTeam');
            const reqEmailIdEl = document.getElementById('reqEmailId');
            
            if (reqNameEl) reqNameEl.value = nameVal;
            
            if (reqTeamEl) {
                reqTeamEl.disabled = false;
                
                // 스프레드시트의 소속팀 텍스트가 HTML select 옵션에 없는 경우 동적으로 추가
                if (teamVal) {
                    let hasOption = false;
                    for (let i = 0; i < reqTeamEl.options.length; i++) {
                        if (reqTeamEl.options[i].value === teamVal) {
                            hasOption = true;
                            break;
                        }
                    }
                    if (!hasOption) {
                        const newOpt = document.createElement('option');
                        newOpt.value = teamVal;
                        newOpt.textContent = teamVal;
                        reqTeamEl.appendChild(newOpt);
                    }
                }
                
                reqTeamEl.value = teamVal;
                reqTeamEl.disabled = true;
            }
            
            if (reqEmailIdEl && emailVal) {
                reqEmailIdEl.value = emailVal.split('@')[0];
            }
        }
    }

    // 네비게이션 및 메뉴 활성화 업데이트 (역할별 권한 가시성 복구)
    function updateNavVisibility() {
        const appContainer = document.querySelector('.app-container');
        
        if (!userRole) {
            // 비로그인 상태일 때는 사이드바 잠금 및 로그인 탭만 노출
            if (navItemRequest) navItemRequest.style.display = 'none';
            if (navItemDashboard) navItemDashboard.style.display = 'none';
            if (navItemReport) navItemReport.style.display = 'none';
            if (navItemProvision) navItemProvision.style.display = 'none';
            if (navItemAdminList) navItemAdminList.style.display = 'none';
            if (navItemUserList) navItemUserList.style.display = 'none';
            if (navItemChatbotAdmin) navItemChatbotAdmin.style.display = 'none';
            if (navItemChatbot) navItemChatbot.style.display = 'none';
            if (navItemAdminRegister) navItemAdminRegister.style.display = 'none';
            if (navItemNotification) navItemNotification.style.display = 'none';
            if (navItemLogin) navItemLogin.style.display = 'block';
            if (navItemLogout) navItemLogout.style.display = 'none';
            if (navUserProfile) navUserProfile.style.display = 'none';
            if (appContainer) appContainer.classList.add('logged-out');
        } else {
            // 로그인 상태일 때는 사용자 프로필 갱신 및 표시
            if (navUserProfile) {
                const nameVal = sessionStorage.getItem('itUserName') || '';
                const teamVal = sessionStorage.getItem('itUserTeam') || '';
                const roleText = userRole === 'admin' ? '관리자' : '임직원';
                
                if (profileName) {
                    profileName.textContent = nameVal + ' 님';
                }
                if (profileRole) {
                    profileRole.textContent = teamVal ? `${teamVal} (${roleText})` : roleText;
                }
                navUserProfile.style.display = 'flex';
            }

            if (userRole === 'admin') {
                // 관리자 권한 탭 노출 제어 (문의 접수 불가)
                if (navItemRequest) navItemRequest.style.display = 'none';
                if (navItemDashboard) navItemDashboard.style.display = 'block';
                if (navItemReport) navItemReport.style.display = 'block';
                if (navItemProvision) navItemProvision.style.display = 'block';
                if (navItemAdminList) navItemAdminList.style.display = 'block';
                if (navItemUserList) navItemUserList.style.display = 'block';
                if (navItemChatbotAdmin) navItemChatbotAdmin.style.display = 'block';
                if (navItemChatbot) navItemChatbot.style.display = 'block';
                if (navItemAdminRegister) navItemAdminRegister.style.display = 'block';
                if (navItemNotification) navItemNotification.style.display = 'none';
                if (navItemLogin) navItemLogin.style.display = 'none';
                if (navItemLogout) navItemLogout.style.display = 'block';
                if (appContainer) appContainer.classList.remove('logged-out');
            } else if (userRole === 'user') {
                // 일반 사용자 권한 탭 노출 제어 (문의 접수, 처리 현황, 챗봇 노출)
                if (navItemRequest) navItemRequest.style.display = 'block';
                if (navItemDashboard) navItemDashboard.style.display = 'block';
                if (navItemReport) navItemReport.style.display = 'none';
                if (navItemProvision) navItemProvision.style.display = 'none';
                if (navItemAdminList) navItemAdminList.style.display = 'none';
                if (navItemUserList) navItemUserList.style.display = 'none';
                if (navItemChatbotAdmin) navItemChatbotAdmin.style.display = 'none';
                if (navItemChatbot) navItemChatbot.style.display = 'block';
                if (navItemAdminRegister) navItemAdminRegister.style.display = 'none';
                if (navItemNotification) navItemNotification.style.display = 'block';
                if (navItemLogin) navItemLogin.style.display = 'none';
                if (navItemLogout) navItemLogout.style.display = 'block';
                if (appContainer) appContainer.classList.remove('logged-out');
            }
        }
    }
    updateNavVisibility();

    // 탭 메뉴 동작
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            // 역할 및 로그인 기반 권한 체크 통제
            if (!userRole) {
                if (targetId !== 'page-login') {
                    alert('로그인이 필요한 서비스입니다.');
                    document.querySelector('.nav-links a[data-target="page-login"]').click();
                    return;
                }
            } else if (userRole === 'user') {
                if (!['page-request', 'page-dashboard', 'page-chatbot', 'page-login', 'page-notification'].includes(targetId)) {
                    alert('접근 권한이 없습니다. (일반 사용자 전용 페이지가 아님)');
                    return;
                }
            } else if (userRole === 'admin') {
                if (targetId === 'page-request') {
                    alert('관리자는 이 기능을 이용할 수 없습니다.');
                    return;
                }
            }

            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');

            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'page-report') updateReport();
            if (targetId === 'page-provision') renderProvisionTable();
            if (targetId === 'page-admin-list') loadAdminList();
            if (targetId === 'page-user-list') loadUserList();
            if (targetId === 'page-chatbot-admin') loadChatbotGuides();
            if (targetId === 'page-request') {
                fillUserInfo();
                checkAndRestoreDraft();
            }
            if (targetId === 'page-notification') markAllNotificationsAsRead();

            // 처리 현황 등에 들어갈 때마다 최신 데이터 다시 받아옴
            if (['page-dashboard', 'page-report', 'page-provision', 'page-admin-list', 'page-user-list', 'page-chatbot-admin', 'page-notification'].includes(targetId)) {
                loadData();
            }

            sessionStorage.setItem('activeTab', targetId);
        });
    });

    // 새로고침 시 권한에 따른 초기 탭 포커싱
    const activeTab = sessionStorage.getItem('activeTab');
    if (!userRole) {
        const loginTabLink = document.querySelector(`.nav-links a[data-target="page-login"]`);
        if (loginTabLink) loginTabLink.click();
    } else {
        if (activeTab && document.querySelector(`.nav-links a[data-target="${activeTab}"]`)) {
            // 권한 유효성 체크 후 탭 복원
            if (userRole === 'user' && ['page-request', 'page-dashboard', 'page-chatbot'].includes(activeTab)) {
                document.querySelector(`.nav-links a[data-target="${activeTab}"]`).click();
            } else if (userRole === 'admin' && ['page-dashboard', 'page-report', 'page-provision', 'page-admin-list', 'page-admin-register', 'page-user-list', 'page-chatbot', 'page-chatbot-admin'].includes(activeTab)) {
                document.querySelector(`.nav-links a[data-target="${activeTab}"]`).click();
            } else {
                // 권한 범위 밖인 경우 권한에 따른 기본값 지정
                if (userRole === 'admin') {
                    document.querySelector('.nav-links a[data-target="page-dashboard"]').click();
                } else {
                    document.querySelector('.nav-links a[data-target="page-chatbot"]').click();
                }
            }
        } else {
            if (userRole === 'admin') {
                document.querySelector('.nav-links a[data-target="page-dashboard"]').click();
            } else {
                document.querySelector('.nav-links a[data-target="page-chatbot"]').click();
            }
        }
    }

    // 로그인 로그아웃 처리
    const loginForm = document.getElementById('loginForm');
    const btnLogout = document.getElementById('btnLogout');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('loginId').value.trim();
            const pw = document.getElementById('loginPw').value;

            // SHA-256 해시를 이용한 보안 로그인 처리
            const encoder = new TextEncoder();
            const data = encoder.encode(id + ":" + pw);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            let isValid = false;
            let resRole = '';
            let resName = '';
            let resTeam = '';
            let resEmail = '';
            
            showLoading();
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    // 로컬 테스트 모드: admin:1234 고정 로그인 허용 및 일반 사용자 로컬 DB 매칭 허용
                    if (hashHex === 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c' && id === 'admin') {
                        isValid = true;
                        resRole = 'admin';
                        resName = '마스터 관리자';
                        resEmail = 'admin@swei.co.kr';
                    } else {
                        // 로컬 사용자 DB에서 매칭 시도
                        const localUsers = JSON.parse(localStorage.getItem('localUsersDB') || '[]');
                        const userObj = localUsers.find(u => u.username === id && u.passwordHash === hashHex);
                        if (userObj) {
                            isValid = true;
                            resRole = 'user';
                            resName = userObj.name;
                            resTeam = userObj.team;
                            resEmail = userObj.email;
                        } else if (id === 'testuser' && (hashHex === 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c' || pw === '1234')) {
                            isValid = true;
                            resRole = 'user';
                            resName = '테스트유저';
                            resTeam = '전산팀';
                            resEmail = 'testuser@swei.co.kr';
                        }
                    }
                } else {
                    // 서버 사이드 검증 요청
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'login',
                            username: id,
                            passwordHash: hashHex
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success' && result.isValid) {
                            isValid = true;
                            resRole = result.role;
                            resName = result.name;
                            resTeam = result.team;
                            resEmail = result.email;
                        }
                    }
                }
            } catch (err) {
                console.error('로그인 검증 실패:', err);
            } finally {
                hideLoading();
            }

            if (isValid) {
                userRole = resRole;
                isAdmin = (resRole === 'admin');
                userLoginId = id;
                userPasswordHash = hashHex;
                
                sessionStorage.setItem('itUserRole', resRole);
                sessionStorage.setItem('itUserName', resName || '');
                sessionStorage.setItem('itUserTeam', resTeam || '');
                sessionStorage.setItem('itUserEmail', resEmail || '');
                sessionStorage.setItem('itUserLoginId', id);
                sessionStorage.setItem('itUserPasswordHash', hashHex);
                
                alert(`${resName}님, 로그인되었습니다.`);

                updateNavVisibility();
                
                // 로그인 완료 후 데이터 조회 시도
                await loadData();
                
                if (resRole === 'admin') {
                    document.querySelector('.nav-links a[data-target="page-dashboard"]').click();
                } else {
                    document.querySelector('.nav-links a[data-target="page-chatbot"]').click();
                }
                loginForm.reset();
            } else {
                alert('아이디 또는 비밀번호가 일치하지 않습니다.');
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('로그아웃 하시겠습니까?')) {
                userRole = '';
                isAdmin = false;
                userLoginId = '';
                userPasswordHash = '';
                requests = [];
                
                sessionStorage.removeItem('itUserRole');
                sessionStorage.removeItem('itUserName');
                sessionStorage.removeItem('itUserTeam');
                sessionStorage.removeItem('itUserEmail');
                sessionStorage.removeItem('itUserLoginId');
                sessionStorage.removeItem('itUserPasswordHash');
                sessionStorage.removeItem('activeTab');

                alert('로그아웃 되었습니다.');
                updateNavVisibility();
                renderTable();
                
                document.querySelector('.nav-links a[data-target="page-login"]').click();
            }
        });
    }


    const dateEles = document.querySelectorAll('#currentDate');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateEles.forEach(el => el.textContent = todayStr);

    const yearMonthStr = `${today.getFullYear()}년 ${String(today.getMonth() + 1).padStart(2, '0')}월`;
    const reportTitle = document.getElementById('reportTitleYearMonth');
    if (reportTitle) reportTitle.textContent = `[${yearMonthStr}] IT 전산 문의 처리 실적 보고서`;

    const noteBox = document.getElementById('reportNoteBox');
    if (noteBox) {
        const savedNote = localStorage.getItem('itReportNote');
        if (savedNote) noteBox.innerHTML = savedNote;
        noteBox.addEventListener('input', () => {
            localStorage.setItem('itReportNote', noteBox.innerHTML);
        });
    }

    const requestForm = document.getElementById('requestForm');
    const adminRegisterForm = document.getElementById('adminRegisterForm');
    const requestTableBody = document.querySelector('#requestTable tbody');

    const elTotal = document.getElementById('kpiTotal');
    const elInProgress = document.getElementById('kpiInProgress');
    const elCompleted = document.getElementById('kpiCompleted');
    const elRejected = document.getElementById('kpiRejected');

    // ==========================================
    // 이미지 첨부 및 미리보기 구현
    // ==========================================
    const reqDescEle = document.getElementById('reqDesc');
    const reqImageInput = document.getElementById('reqImageInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');

    function resizeAndProcessImage(file) {
        if (attachedImages.length >= 3) {
            alert('이미지는 최대 3장까지만 첨부할 수 있습니다.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                attachedImages.push(dataUrl);
                renderImagePreviews();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    if (reqDescEle) {
        reqDescEle.addEventListener('paste', (e) => {
            const items = (e.clipboardData || window.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') === 0) {
                    const blob = items[i].getAsFile();
                    resizeAndProcessImage(blob);
                    e.preventDefault();
                }
            }
        });
    }

    if (reqImageInput) {
        reqImageInput.addEventListener('change', (e) => {
            const files = e.target.files;
            for (let i = 0; i < files.length; i++) {
                resizeAndProcessImage(files[i]);
            }
            reqImageInput.value = ''; // 동일 파일 재첨부 가능하도록 초기화
        });
    }

    // ==========================================
    // 일반 파일 첨부 처리 (PDF, Excel, PPT, Word 등)
    // ==========================================
    const reqFileInput = document.getElementById('reqFileInput');
    const fileListContainer = document.getElementById('fileListContainer');

    // 파일명 또는 MIME 타입에 따른 아이콘 반환
    function getFileIcon(filename, mimeType) {
        const ext = filename.split('.').pop().toLowerCase();
        const mime = (mimeType || '').toLowerCase();
        
        if (ext === 'pdf' || mime.includes('pdf')) return '<i class="fa-solid fa-file-pdf" style="color:#e74c3c;"></i>';
        if (['xls', 'xlsx', 'xlsb', 'xlsm', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '<i class="fa-solid fa-file-excel" style="color:#27ae60;"></i>';
        if (['ppt', 'pptx', 'ppsx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return '<i class="fa-solid fa-file-powerpoint" style="color:#e67e22;"></i>';
        if (['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('document')) return '<i class="fa-solid fa-file-word" style="color:#2980b9;"></i>';
        if (['hwp', 'hwpx'].includes(ext)) return '<i class="fa-solid fa-file-word" style="color:#1abc9c;"></i>'; // 아래한글 전용 청록색 아이콘
        if (['zip', 'rar', '7z'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return '<i class="fa-solid fa-file-zipper" style="color:#8e44ad;"></i>';
        if (ext === 'txt' || mime.includes('text')) return '<i class="fa-solid fa-file-lines" style="color:#7f8c8d;"></i>';
        return '<i class="fa-solid fa-file" style="color:#95a5a6;"></i>';
    }

    // 파일 목록 UI 렌더링
    window.renderFilePreviews = function() {
        if (!fileListContainer) return;
        fileListContainer.innerHTML = '';
        attachedFiles.forEach((f, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; flex-direction:column; gap:4px; padding:10px 12px; background:#f8fafc; border:1px solid var(--border-color); border-radius:8px;';

            let statusHtml = '';
            if (f.status === 'uploading') {
                statusHtml = `<span style="color:var(--primary); font-size:0.82rem; font-weight:600;"><i class="fa-solid fa-spinner fa-spin"></i> 업로드 중 (${f.progress || 0}%)</span>`;
            } else if (f.status === 'done' && f.url) {
                statusHtml = `<a href="${f.url}" target="_blank" style="color:#27ae60; font-size:0.82rem; text-decoration:none; font-weight:600;"><i class="fa-solid fa-check"></i> 업로드 완료</a>`;
            } else if (f.status === 'pending') {
                // 상세 에러 텍스트를 말풍선(title)과 함께 화면에 명시
                statusHtml = `<span style="color:#e67e22; font-size:0.82rem; font-weight:600;" title="${f.errorMsg || '알 수 없는 오류'}"><i class="fa-solid fa-triangle-exclamation"></i> 실패 (${f.errorMsg || '오류'})</span>`;
            }

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                    ${getFileIcon(f.name, f.mimeType)}
                    <span style="flex:1; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.name}">${f.name}</span>
                    ${statusHtml}
                    <button type="button" data-file-index="${index}" style="background:none; border:none; cursor:pointer; color:var(--text-muted); padding:2px 6px; font-size:1rem;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="upload-progress-wrapper">
                    <div class="upload-progress-bar ${f.status}" style="width: ${f.progress || 0}%;"></div>
                </div>
            `;
            fileListContainer.appendChild(div);
        });

        // 삭제 버튼 이벤트 바인딩
        fileListContainer.querySelectorAll('button[data-file-index]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-file-index'));
                attachedFiles.splice(idx, 1);
                window.renderFilePreviews();
            });
        });
    };

    // 파일 1개를 구글 드라이브에 업로드하고 URL 및 에러 정보 반환
    async function uploadFileToGoogleDrive(fileObj) {
        if (!GOOGLE_SCRIPT_URL) return { url: null, error: '웹 앱 URL 없음' };
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'uploadFile',
                    filename: fileObj.name,
                    mimeType: fileObj.mimeType,
                    base64: fileObj.base64
                })
            });
            if (!response.ok) {
                return { url: null, error: `서버 응답 오류 (HTTP ${response.status})` };
            }
            const result = await response.json();
            if (result.status === 'success') {
                return { url: result.url, error: null };
            } else {
                return { url: null, error: result.message || '서버 처리 실패' };
            }
        } catch (err) {
            console.error('파일 업로드 오류:', err);
            return { url: null, error: '네트워크 연결/CORS 오류' };
        }
    }

    // 파일 선택 시 처리 (FileReader → Base64 변환 후 배열에 추가 + 즉시 드라이브 업로드)
    if (reqFileInput) {
        reqFileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const MAX_FILES = 3;
            const availableSlots = MAX_FILES - attachedFiles.length;
            if (availableSlots <= 0) {
                alert('파일은 최대 3개까지만 첨부할 수 있습니다.');
                reqFileInput.value = '';
                return;
            }
            const toProcess = files.slice(0, availableSlots);
            if (files.length > availableSlots) {
                alert(`파일은 최대 3개까지 첨부 가능합니다. ${toProcess.length}개만 추가됩니다.`);
            }

            for (const file of toProcess) {
                // 파일 크기 제한: 10MB
                if (file.size > 10 * 1024 * 1024) {
                    alert(`'${file.name}' 파일이 10MB를 초과합니다. 더 작은 파일을 선택해 주세요.`);
                    continue;
                }
                const fileObj = { name: file.name, mimeType: file.type || 'application/octet-stream', base64: '', url: '', status: 'uploading', progress: 0, errorMsg: '' };
                attachedFiles.push(fileObj);
                window.renderFilePreviews();

                // 1단계: FileReader로 Base64 변환
                fileObj.progress = 10;
                window.renderFilePreviews();

                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        // data:mimeType;base64,XXX 에서 XXX 부분만 추출
                        const b64 = ev.target.result.split(',')[1];
                        resolve(b64);
                    };
                    reader.readAsDataURL(file);
                });

                fileObj.base64 = base64;
                fileObj.progress = 25;
                window.renderFilePreviews();

                // 2단계: 구글 드라이브 업로드 개시 및 가짜 프로그레스 타이머 작동 (부드럽게 90%까지 채우기)
                let progressInterval = setInterval(() => {
                    if (fileObj.progress < 90) {
                        fileObj.progress += 3;
                        window.renderFilePreviews();
                    }
                }, 150);

                showLoading();
                const uploadResult = await uploadFileToGoogleDrive(fileObj);
                hideLoading();

                clearInterval(progressInterval);

                // 3단계: 결과 처리
                if (uploadResult.url) {
                    fileObj.url = uploadResult.url;
                    fileObj.status = 'done';
                    fileObj.progress = 100;
                } else {
                    fileObj.url = '';
                    fileObj.status = 'pending';
                    fileObj.progress = 0;
                    fileObj.errorMsg = uploadResult.error || '업로드 실패';
                }
                fileObj.base64 = ''; // 업로드 완료 후 base64 데이터 제거 (메모리 절약)
                window.renderFilePreviews();
            }
            reqFileInput.value = '';
        });
    }

    window.renderImagePreviews = function () {
        if (!imagePreviewContainer) return;
        imagePreviewContainer.innerHTML = '';
        attachedImages.forEach((dataUrl, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${dataUrl}">
                <button type="button" class="btn-remove-img" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;
            imagePreviewContainer.appendChild(div);
        });

        const removeBtns = imagePreviewContainer.querySelectorAll('.btn-remove-img');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                attachedImages.splice(idx, 1);
                renderImagePreviews();
            });
        });
    };

    // 폼 제출 이벤트 (문의 접수)
    if (requestForm) {
        requestForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('reqName').value;
            const team = document.getElementById('reqTeam').value;
            const emailId = document.getElementById('reqEmailId').value;
            const email = emailId ? `${emailId}@swei.co.kr` : '';
            const category = document.getElementById('reqCategory').value;
            const title = document.getElementById('reqTitle').value;
            const desc = document.getElementById('reqDesc').value;
            const password = ''; // 임직원 로그인이 적용되어 개별 비밀번호 불필요
            const editId = document.getElementById('editReqId') ? document.getElementById('editReqId').value : '';

            if (editId) {
                const targetReq = requests.find(r => r.id == editId);
                if (targetReq) {
                    targetReq.name = name;
                    targetReq.team = team;
                    targetReq.email = email;
                    targetReq.category = category;
                    targetReq.title = title;
                    targetReq.desc = desc;
                    targetReq.images = [...attachedImages];
                    targetReq.password = password;
                }
                const success = await saveDataAsync();
                if (success) {
                    renderTable();
                    alert('문의 내용이 수정되었습니다.');
                    cancelEditMode();
                    document.querySelector('.nav-links a[data-target="page-dashboard"]').click();
                }
            } else {
                // 첨부 파일 URL 목록 추출 (드라이브 업로드 완료된 파일)
                const fileAttachments = attachedFiles
                    .filter(f => f.url)
                    .map(f => ({ name: f.name, url: f.url }));

                const newRequest = {
                    id: generateId(),
                    name, team, email, category, title, desc,
                    images: [...attachedImages],
                    fileAttachments: fileAttachments,
                    status: '접수', date: new Date().toISOString(), password
                };

                requests.push(newRequest);
                const success = await saveDataAsync(); // 구글 서버에 전송 대기

                if (success) {
                    renderTable();
                    alert('문의가 성공적으로 접수되었습니다.');
                    clearDraft(); // 임시 작성 초안 삭제
                    requestForm.reset();
                    attachedImages = [];
                    attachedFiles = [];
                    renderImagePreviews();
                    window.renderFilePreviews();
                    document.querySelector('.nav-links a[data-target="page-dashboard"]').click();
                }
            }
        });
    }

    // 관리자 직접 구두 문의 등록 제출 이벤트
    if (adminRegisterForm) {
        adminRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('adminReqName').value.trim();
            const team = document.getElementById('adminReqTeam').value;
            const emailId = document.getElementById('adminReqEmailId').value.trim();
            const email = emailId ? `${emailId}@swei.co.kr` : '';
            const category = document.getElementById('adminReqCategory').value;
            const title = document.getElementById('adminReqTitle').value.trim();
            const desc = document.getElementById('adminReqDesc').value.trim();
            const status = '완료'; // 구두 등록은 항상 완료 상태
            const resolution = document.getElementById('adminReqResolution').value.trim();
            const password = 'admin_direct';

            const newRequest = {
                id: generateId(),
                name, team, email, category, title, desc,
                images: [],
                fileAttachments: [],
                status,
                date: new Date().toISOString(),
                password,
                completeReason: '구두 문의 완료' // 구두 문의에 대한 기본 완료 사유 지정
            };

            if (resolution) {
                newRequest.resolution = resolution;
            }

            requests.push(newRequest);
            const success = await saveDataAsync(); // 구글 서버에 전송 대기 또는 로컬 저장

            if (success) {
                renderTable();
                alert('구두 문의 및 조치 내역이 성공적으로 등록되었습니다.');
                adminRegisterForm.reset();
                document.querySelector('.nav-links a[data-target="page-dashboard"]').click();
            }
        });
    }

    function cancelEditMode() {
        if(requestForm) {
            requestForm.reset();
            fillUserInfo(); // 리셋 후 사용자 정보 재바인딩
        }
        const editReqId = document.getElementById('editReqId');
        if(editReqId) editReqId.value = '';
        attachedImages = [];
        attachedFiles = [];
        renderImagePreviews();
        if (window.renderFilePreviews) window.renderFilePreviews();
        const btnSubmit = document.getElementById('btnSubmitRequest');
        if(btnSubmit) btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 문의 등록하기';
        const btnCancel = document.getElementById('btnCancelEdit');
        if(btnCancel) btnCancel.style.display = 'none';
        const titleEl = document.getElementById('pageRequestTitle');
        if(titleEl) titleEl.textContent = '전산 문의 접수';
        const descEl = document.getElementById('pageRequestDesc');
        if(descEl) descEl.textContent = '전산 관련 도움이 필요하신 내용을 입력해 주세요.';
        clearDraft(); // 편집 취소 시에도 초안 청소
    }

    // === 임시 초안 저장/복구 비즈니스 로직 ===
    function clearDraft() {
        if (userLoginId) {
            localStorage.removeItem(`draftRequest_${userLoginId}`);
        }
    }

    function saveDraft() {
        if (!userLoginId) return;
        
        // 수정 모드인 경우 초안 저장을 건너뜀
        const editIdEl = document.getElementById('editReqId');
        if (editIdEl && editIdEl.value) return;

        const categoryEl = document.getElementById('reqCategory');
        const titleEl = document.getElementById('reqTitle');
        const descEl = document.getElementById('reqDesc');
        
        const category = categoryEl ? categoryEl.value : '';
        const title = titleEl ? titleEl.value : '';
        const desc = descEl ? descEl.value : '';
        
        if (!category && !title && !desc) {
            localStorage.removeItem(`draftRequest_${userLoginId}`);
            return;
        }
        
        localStorage.setItem(`draftRequest_${userLoginId}`, JSON.stringify({ category, title, desc }));
    }

    function checkAndRestoreDraft() {
        if (!userLoginId) return;
        const draft = localStorage.getItem(`draftRequest_${userLoginId}`);
        if (draft) {
            try {
                const data = JSON.parse(draft);
                const categoryEl = document.getElementById('reqCategory');
                const titleEl = document.getElementById('reqTitle');
                const descEl = document.getElementById('reqDesc');
                
                const isFormEmpty = (!categoryEl.value && !titleEl.value && !descEl.value);
                
                if (isFormEmpty && (data.category || data.title || data.desc)) {
                    if (confirm('이전에 작성 중이던 임시 저장된 문의 내용이 있습니다. 불러오시겠습니까?')) {
                        if (categoryEl && data.category) categoryEl.value = data.category;
                        if (titleEl && data.title) titleEl.value = data.title;
                        if (descEl && data.desc) descEl.value = data.desc;
                    } else {
                        clearDraft();
                    }
                }
            } catch (e) {
                console.error('초안 복구 실패:', e);
            }
        }
    }

    // 입력 감지 이벤트 바인딩
    ['reqCategory', 'reqTitle', 'reqDesc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', saveDraft);
            el.addEventListener('change', saveDraft);
        }
    });

    // === 알림 센터 비즈니스 로직 ===
    window.updateNotifications = function() {
        if (userRole !== 'user') return;
        
        const itUserEmail = sessionStorage.getItem('itUserEmail') || '';
        if (!itUserEmail) return;

        // 내 문의 내역 필터링
        const myRequests = requests.filter(r => r.email === itUserEmail);

        let seenStatus = {};
        try {
            seenStatus = JSON.parse(localStorage.getItem(`seenRequestStatus_${userLoginId}`)) || {};
        } catch (e) {
            seenStatus = {};
        }

        let newNotificationCount = 0;
        const listContainer = document.getElementById('notificationList');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';

        // 최신 등록순으로 정렬
        const sortedMyRequests = [...myRequests].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedMyRequests.forEach(r => {
            const prevStatus = seenStatus[r.id];
            
            // 상태 변화 감지 기준
            const isChanged = (prevStatus !== undefined && prevStatus !== r.status) || 
                              (prevStatus === undefined && r.status !== '접수');
            
            if (isChanged) {
                newNotificationCount++;
            }

            let statusColor = 'var(--primary)';
            if (r.status === '완료') statusColor = 'var(--secondary)';
            if (r.status === '반려') statusColor = 'var(--danger)';
            if (r.status === '보류') statusColor = 'var(--warning)';

            let msg = '';
            let detail = '';
            if (r.status === '처리중') {
                msg = `접수하신 문의 [#${r.id}] 건의 상태가 <strong>[처리중]</strong>으로 변경되었습니다.`;
            } else if (r.status === '보류') {
                msg = `접수하신 문의 [#${r.id}] 건이 <strong>[보류]</strong> 상태로 전환되었습니다.`;
            } else if (r.status === '완료') {
                msg = `접수하신 문의 [#${r.id}] 건이 해결되어 <strong>[완료]</strong> 처리되었습니다.`;
                if (r.completeReason) detail = `처리 내역: ${r.completeReason}`;
            } else if (r.status === '반려') {
                msg = `접수하신 문의 [#${r.id}] 건이 <strong>[반려]</strong> 처리되었습니다.`;
                if (r.rejectReason) detail = `반려 사유: <span style="color:var(--danger);">${r.rejectReason}</span>`;
            } else {
                msg = `접수하신 문의 [#${r.id}] 건이 <strong>[접수]</strong> 완료되었습니다.`;
            }

            const item = document.createElement('div');
            item.style.cssText = 'padding: 14px 18px; border: 1px solid var(--border-color); border-radius: 8px; background-color: ' + (isChanged ? '#f0fdf4' : 'white') + '; display: flex; flex-direction: column; gap: 6px; position: relative; box-shadow: var(--shadow-sm);';
            
            const dateStr = new Date(r.date).toLocaleDateString('ko-KR', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
            
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; color:var(--text-muted);">${dateStr} | 문의 번호 #${r.id}</span>
                    <span class="tag" style="background-color:${statusColor}15; color:${statusColor}; font-weight:600; padding:2px 8px; border-radius:4px; font-size:0.8rem;">${r.status}</span>
                </div>
                <div style="font-size:0.95rem; color:var(--text-main); margin-top:2px;">
                    <strong>[${r.category}] ${r.title}</strong>
                </div>
                <div style="font-size:0.88rem; color:var(--text-color); margin-top:2px;">
                    ${msg}
                </div>
                ${detail ? `<div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px; padding:8px 12px; background-color:#f8fafc; border-radius:6px; border-left: 3px solid ${statusColor}; font-weight:500;">${detail}</div>` : ''}
                ${isChanged ? `<span style="position:absolute; top:12px; right:12px; width:8px; height:8px; background-color:#ef4444; border-radius:50%;" title="새 알림"></span>` : ''}
            `;
            listContainer.appendChild(item);
        });

        if (myRequests.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px 10px;">접수한 문의가 없어 수신된 알림이 없습니다.</div>`;
        }

        // 알림 배지 숫자 노출 제어
        if (newNotificationCount > 0) {
            if (notificationBadge) {
                notificationBadge.textContent = newNotificationCount;
                notificationBadge.style.display = 'inline-block';
            }
        } else {
            if (notificationBadge) {
                notificationBadge.style.display = 'none';
            }
        }
    };

    window.markAllNotificationsAsRead = function() {
        if (userRole !== 'user' || !userLoginId) return;
        
        const itUserEmail = sessionStorage.getItem('itUserEmail') || '';
        if (!itUserEmail) return;

        const myRequests = requests.filter(r => r.email === itUserEmail);
        
        const seenStatus = {};
        myRequests.forEach(r => {
            seenStatus[r.id] = r.status;
        });

        localStorage.setItem(`seenRequestStatus_${userLoginId}`, JSON.stringify(seenStatus));
        updateNotifications();
    };

    const btnMarkAllRead = document.getElementById('btnMarkAllRead');
    if (btnMarkAllRead) {
        btnMarkAllRead.addEventListener('click', markAllNotificationsAsRead);
    }

    const btnCancelEdit = document.getElementById('btnCancelEdit');
    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', cancelEditMode);
    }

    function generateId() {
        if (requests.length === 0) return 1;
        const maxId = Math.max(...requests.map(r => r.id));
        return maxId + 1;
    }

    // 관리자 전체 초기화
    const btnClearData = document.getElementById('btnClearData');
    if (btnClearData) {
        btnClearData.addEventListener('click', async () => {
            if (confirm('정말 모든 접수 내역을 스프레드시트에서 삭제하시겠습니까? (복구 불가)')) {
                requests = []; // 문의내역만 초기화, 관리자 계정은 유지
                await saveDataAsync();
                renderTable();
                alert('초기화 되었습니다.');
            }
        });
    }

    // 필터 이벤트 리스너
    const searchTitleEl = document.getElementById('searchTitle');
    const filterCategoryEl = document.getElementById('filterCategory');
    const filterDateRangeEl = document.getElementById('filterDateRange');
    const sortOrderEl = document.getElementById('sortOrder');

    if (searchTitleEl) searchTitleEl.addEventListener('input', () => { currentPage = 1; renderTable(); });
    if (filterCategoryEl) filterCategoryEl.addEventListener('change', () => { currentPage = 1; renderTable(); });
    if (filterDateRangeEl) filterDateRangeEl.addEventListener('change', () => { currentPage = 1; renderTable(); });
    if (sortOrderEl) sortOrderEl.addEventListener('change', () => { currentPage = 1; renderTable(); });

    // 지급/설치 내역 전용 필터 이벤트 리스너
    const searchProvisionEl = document.getElementById('searchProvision');
    const filterProvisionCategoryEl = document.getElementById('filterProvisionCategory');

    if (searchProvisionEl) searchProvisionEl.addEventListener('input', () => { if (window.renderProvisionTable) window.renderProvisionTable(); });
    if (filterProvisionCategoryEl) filterProvisionCategoryEl.addEventListener('change', () => { if (window.renderProvisionTable) window.renderProvisionTable(); });

    let currentPage = 1;
    const itemsPerPage = 10;
    let currentFilter = 'all';

    window.filterTable = function (filter) {
        currentFilter = filter;
        currentPage = 1;
        renderTable();

        const cards = document.querySelectorAll('.kpi-card');
        const activeCardMap = { 'all': 0, 'in-progress': 1, 'completed': 2, 'rejected': 3 };

        cards.forEach((card, index) => {
            if (index === activeCardMap[filter]) {
                card.style.border = '2px solid var(--primary)';
                card.style.transform = 'translateY(-3px)';
                card.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)';
            } else {
                card.style.border = '2px solid transparent';
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            }
        });
    };

    window.changePage = function (page) {
        currentPage = page;
        renderTable();
    };

    function renderPagination(totalPages) {
        let paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pagination';
            paginationContainer.style.display = 'flex';
            paginationContainer.style.justifyContent = 'center';
            paginationContainer.style.alignItems = 'center';
            paginationContainer.style.gap = '8px';
            paginationContainer.style.padding = '20px 0 10px 0';

            const tableResponsive = document.querySelector('.table-responsive');
            tableResponsive.parentNode.appendChild(paginationContainer);
        }

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '';
        const btnStyle = "padding: 6px 12px; border: 1px solid var(--border-color); background: white; cursor: pointer; border-radius: 4px; color: var(--text-color); font-weight: 500; font-family: inherit; transition: all 0.2s;";
        const activeStyle = "padding: 6px 12px; border: 1px solid var(--primary); background: var(--primary); cursor: default; border-radius: 4px; color: white; font-weight: bold; font-family: inherit;";
        const disabledStyle = "padding: 6px 12px; border: 1px solid #eee; background: #f9f9f9; cursor: not-allowed; border-radius: 4px; color: #bbb; font-family: inherit;";

        const prevStyle = currentPage === 1 ? disabledStyle : btnStyle;
        html += `<button style="${prevStyle}" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" title="이전 페이지"><i class="fa-solid fa-chevron-left"></i></button>`;

        for (let i = 1; i <= totalPages; i++) {
            const currentStyle = i === currentPage ? activeStyle : btnStyle;
            html += `<button style="${currentStyle}" onclick="changePage(${i})">${i}</button>`;
        }

        const nextStyle = currentPage === totalPages ? disabledStyle : btnStyle;
        html += `<button style="${nextStyle}" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" title="다음 페이지"><i class="fa-solid fa-chevron-right"></i></button>`;

        paginationContainer.innerHTML = html;
    }

    // 테이블 렌더링
    window.renderTable = function () {
        requestTableBody.innerHTML = '';

        const thStatusCol = document.getElementById('thStatusCol');
        const thDeleteCol = document.getElementById('thDeleteCol');
        if (isAdmin) {
            if (btnClearData) btnClearData.style.display = 'inline-block';
            if (thDeleteCol) thDeleteCol.style.display = 'table-cell';
            if (thStatusCol) thStatusCol.textContent = '상태 관리';
        } else {
            if (btnClearData) btnClearData.style.display = 'none';
            if (thDeleteCol) thDeleteCol.style.display = 'none';
            if (thStatusCol) thStatusCol.textContent = '진행 상태';
        }

        let filteredRequests = requests;
        if (currentFilter === 'in-progress') {
            filteredRequests = filteredRequests.filter(r => ['접수', '처리중', '보류'].includes(r.status));
        } else if (currentFilter === 'completed') {
            filteredRequests = filteredRequests.filter(r => r.status === '완료');
        } else if (currentFilter === 'rejected') {
            filteredRequests = filteredRequests.filter(r => r.status === '반려');
        }

        // 1. 검색어 필터 (제목)
        const searchTerm = document.getElementById('searchTitle') ? document.getElementById('searchTitle').value.trim().toLowerCase() : '';
        if (searchTerm !== '') {
            filteredRequests = filteredRequests.filter(r => r.title && r.title.toLowerCase().includes(searchTerm));
        }

        // 2. 카테고리 필터
        const filterCategory = document.getElementById('filterCategory') ? document.getElementById('filterCategory').value : 'all';
        if (filterCategory !== 'all') {
            filteredRequests = filteredRequests.filter(r => r.category === filterCategory);
        }

        // 3. 기간 필터 (1, 3, 6개월)
        const filterDateRange = document.getElementById('filterDateRange') ? document.getElementById('filterDateRange').value : 'all';
        if (filterDateRange !== 'all') {
            const months = parseInt(filterDateRange, 10);
            const limitDate = new Date();
            limitDate.setMonth(limitDate.getMonth() - months);
            filteredRequests = filteredRequests.filter(r => new Date(r.date) >= limitDate);
        }

        // 4. 정렬 (기본값: 최신순 desc)
        const sortOrder = document.getElementById('sortOrder') ? document.getElementById('sortOrder').value : 'desc';
        filteredRequests.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        const sortedRequests = filteredRequests;
        const totalPages = Math.ceil(sortedRequests.length / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentData = sortedRequests.slice(startIndex, endIndex);

        currentData.forEach(req => {
            const tr = document.createElement('tr');
            tr.className = 'clickable-row';
            tr.onclick = (e) => {
                if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'I') return;
                openDetailModal(req.id);
            };

            let statusHtml = '';
            let deleteHtml = '';

            if (isAdmin) {
                const statusClass = `status-${req.status}`;
                statusHtml = `
                    <select class="status-select ${statusClass}" onchange="changeStatus(${req.id}, this)">
                        <option value="접수" ${req.status === '접수' ? 'selected' : ''}>🔴 접수</option>
                        <option value="처리중" ${req.status === '처리중' ? 'selected' : ''}>🟡 처리중</option>
                        <option value="보류" ${req.status === '보류' ? 'selected' : ''}>⚪ 보류</option>
                        <option value="완료" ${req.status === '완료' ? 'selected' : ''}>🟢 완료</option>
                        <option value="반려" ${req.status === '반려' ? 'selected' : ''}>❌ 반려</option>
                    </select>
                `;
                deleteHtml = `<td><button class="btn-del" onclick="deleteReq(${req.id})"><i class="fa-solid fa-trash"></i></button></td>`;
            } else {
                statusHtml = `
                    <span class="tag status-${req.status}" style="font-size: 0.85rem; padding: 6px 10px; border: 1px solid var(--border-color);">
                        ${req.status === '접수' ? '🔴 접수' : ''}
                        ${req.status === '처리중' ? '🟡 처리중' : ''}
                        ${req.status === '보류' ? '⚪ 보류' : ''}
                        ${req.status === '완료' ? '🟢 완료' : ''}
                        ${req.status === '반려' ? '❌ 반려' : ''}
                    </span>
                `;
                deleteHtml = `<td style="display:none;"></td>`;
            }

            tr.innerHTML = `
                <td>${req.id}</td>
                <td>${req.name}</td>
                <td>${req.team}</td>
                <td><strong>${req.category}</strong></td>
                <td>${req.title ? (req.title.length > 20 ? req.title.substring(0, 20) + '...' : req.title) : '-'}</td>
                <td>${statusHtml}</td>
                ${isAdmin ? deleteHtml : ''}
            `;
            requestTableBody.appendChild(tr);
        });

        updateDashboardKPI();

        if (isAdmin) {
            updateReport();
        }

        renderPagination(totalPages);
    };

    // 지급/설치 내역 렌더링
    window.renderProvisionTable = function () {
        const tbody = document.querySelector('#provisionTable tbody');
        const countSpan = document.getElementById('provisionCount');
        if (!tbody) return;
        tbody.innerHTML = '';

        let provisionRequests = requests.filter(r =>
            r.status === '완료' &&
            (r.category === '프로그램 설치' || r.category === '소모품 필요')
        );

        // 검색어 필터
        const searchTerm = document.getElementById('searchProvision') ? document.getElementById('searchProvision').value.trim().toLowerCase() : '';
        if (searchTerm !== '') {
            provisionRequests = provisionRequests.filter(r => r.completeReason && r.completeReason.toLowerCase().includes(searchTerm));
        }

        // 카테고리 필터
        const filterCategory = document.getElementById('filterProvisionCategory') ? document.getElementById('filterProvisionCategory').value : 'all';
        if (filterCategory !== 'all') {
            provisionRequests = provisionRequests.filter(r => r.category === filterCategory);
        }

        // 최신 일자 순으로 정렬
        provisionRequests.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 건수 업데이트
        if (countSpan) {
            countSpan.textContent = `총 ${provisionRequests.length}건`;
        }

        if (provisionRequests.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">검색 조건에 맞는 내역이 없습니다.</td></tr>`;
            return;
        }

        provisionRequests.forEach(req => {
            const tr = document.createElement('tr');
            const dateStr = new Date(req.date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${req.name}</td>
                <td>${req.team}</td>
                <td><span class="tag bg-blue-light" style="font-size:0.85rem; padding: 4px 10px; border-radius: 20px;">${req.category}</span></td>
                <td>${req.completeReason || '-'}</td>
                <td>${req.resolution || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    function updateDashboardKPI() {
        const pubReqs = requests;
        const total = pubReqs.length;
        const rejected = pubReqs.filter(r => r.status === '반려').length;
        const completed = pubReqs.filter(r => r.status === '완료').length;
        const inProgress = pubReqs.filter(r => ['접수', '처리중', '보류'].includes(r.status)).length;

        elTotal.textContent = total + "건";
        elInProgress.textContent = inProgress + "건";
        elCompleted.textContent = completed + "건";
        elRejected.textContent = rejected + "건";
    }

    const CAETGORY_OPTIONS = {
        '프로그램 설치': [
            { value: '오피스', label: '1. 오피스' },
            { value: '한글', label: '2. 한글' },
            { value: 'autocad', label: '3. autocad' },
            { value: 'nx12', label: '4. nx12' },
            { value: '프린터 설치', label: '5. 프린터 설치' },
            { value: '성우비나 ERP', label: '6. 성우비나 ERP' },
            { value: '성우전자 구ERP', label: '7. 성우전자 구ERP' },
            { value: '기타', label: '8. 기타 (직접 입력)' }
        ],
        '고장/오류': [
            { value: '네트워크 오류', label: '1. 네트워크 오류' },
            { value: '어댑터 오류', label: '2. 어댑터 오류' },
            { value: '윈도우 업데이트 오류', label: '3. 윈도우 업데이트 오류' },
            { value: '드라이버 오류', label: '4. 드라이버 오류' },
            { value: '프로그램 오류', label: '5. 프로그램 오류' },
            { value: '기타', label: '6. 기타 (직접 입력)' }
        ],
        '소모품 필요': [
            { value: '마우스', label: '1. 마우스' },
            { value: '키보드', label: '2. 키보드' },
            { value: '마우스 패드', label: '3. 마우스 패드' },
            { value: '건전지', label: '4. 건전지' },
            { value: '어댑터', label: '5. 어댑터' },
            { value: '연결 선', label: '6. 연결 선' },
            { value: 'USB', label: '7. USB' },
            { value: '멀티탭', label: '8. 멀티탭' },
            { value: '기타', label: '9. 기타 (직접 입력)' }
        ]
    };

    function showCompleteModal(req, selectEle, modalTitle, instruction, options) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';
        overlay.style.zIndex = '9999';

        let optionsHtml = options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');

        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>${modalTitle}</h2>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 10px;">${instruction}</p>
                    <select id="progSelect" class="form-control" style="width:100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                        ${optionsHtml}
                    </select>
                    <input type="text" id="progInput" style="width:100%; padding:8px; margin-top:10px; border: 1px solid var(--border-color); border-radius: 4px; display:none;" placeholder="직접 입력하세요">
                    
                    <p style="margin-top: 15px; margin-bottom: 8px; font-weight: 600; font-size: 0.9rem; color: var(--text-main);">해결 과정 (선택사항)</p>
                    <textarea id="progResolution" rows="3" style="width:100%; padding:8px; border: 1px solid var(--border-color); border-radius: 4px; resize: vertical;" placeholder="어떻게 해결했는지 과정을 간략히 적어주세요."></textarea>
                    
                    <div style="margin-top:20px; text-align:right;">
                        <button id="progCancel" style="padding: 8px 16px; border: none; border-radius: 4px; background-color: #e2e8f0; color: #475569; cursor: pointer; margin-right: 8px; font-family: inherit; font-size: 0.95rem; font-weight: 600; transition: background 0.2s;">취소</button>
                        <button id="progSave" style="padding: 8px 16px; border: none; border-radius: 4px; background-color: var(--primary); color: white; cursor: pointer; font-family: inherit; font-size: 0.95rem; font-weight: 600; transition: filter 0.2s;">저장</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const sel = overlay.querySelector('#progSelect');
        const inp = overlay.querySelector('#progInput');
        sel.onchange = () => {
            if (sel.value === '기타') inp.style.display = 'block';
            else inp.style.display = 'none';
        };

        const closeOverlay = () => {
            selectEle.value = req.status; // Revert
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', escListener);
        };

        const escListener = (e) => {
            if (e.key === 'Escape') closeOverlay();
        };
        document.addEventListener('keydown', escListener);

        overlay.querySelector('#progCancel').onclick = closeOverlay;

        overlay.querySelector('#progSave').onclick = async () => {
            document.removeEventListener('keydown', escListener);
            let reason = sel.value;
            if (reason === '기타') reason = inp.value || '기타';
            req.completeReason = reason;

            const resolution = overlay.querySelector('#progResolution').value.trim();
            if (resolution) req.resolution = resolution;
            else delete req.resolution;

            req.status = '완료';
            await saveDataAsync(); // API로 서버 동기화 완료 대기
            selectEle.className = `status-select status-완료`;
            if (isAdmin) updateReport();
            document.body.removeChild(overlay);
        };
    }

    // 반려 처리 시 반려 사유를 입력받는 커스텀 모달
    function showRejectModal(req, selectEle) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';
        overlay.style.zIndex = '9999';

        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 400px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
                <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 20px 24px;">
                    <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">반려 사유 입력</h2>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <p style="margin-bottom: 10px; font-weight: 600; font-size: 0.95rem; color: var(--text-main);">반려 사유를 입력해주세요:</p>
                    <textarea id="rejectReasonInput" rows="3" style="width:100%; padding:10px; border: 1px solid var(--border-color); border-radius: 6px; resize: vertical; font-family: inherit; font-size: 0.9rem;" placeholder="반려 사유를 입력해주세요."></textarea>
                    
                    <div style="margin-top:20px; text-align:right;">
                        <button id="rejectCancel" style="padding: 8px 16px; border: none; border-radius: 6px; background-color: #e2e8f0; color: #475569; cursor: pointer; margin-right: 8px; font-family: inherit; font-size: 0.95rem; font-weight: 600; transition: background 0.2s;">취소</button>
                        <button id="rejectSave" style="padding: 8px 16px; border: none; border-radius: 6px; background-color: var(--primary); color: white; cursor: pointer; font-family: inherit; font-size: 0.95rem; font-weight: 600; transition: filter 0.2s;">저장</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const inp = overlay.querySelector('#rejectReasonInput');
        inp.focus();

        const closeOverlay = () => {
            selectEle.value = req.status; // Revert
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', escListener);
        };

        const escListener = (e) => {
            if (e.key === 'Escape') closeOverlay();
        };
        document.addEventListener('keydown', escListener);

        overlay.querySelector('#rejectCancel').onclick = closeOverlay;

        overlay.querySelector('#rejectSave').onclick = async () => {
            const reason = inp.value.trim();
            if (!reason) {
                alert('반려 사유를 입력해주세요.');
                return;
            }
            document.removeEventListener('keydown', escListener);
            req.rejectReason = reason;
            req.completeReason = '';
            delete req.resolution;

            req.status = '반려';
            await saveDataAsync();
            selectEle.className = 'status-select status-반려';
            selectEle.value = '반려';
            if (isAdmin) updateReport();
            document.body.removeChild(overlay);
        };
    }

    // 옵션 지정이 없는 카테고리의 처리 내역을 입력받는 커스텀 완료 모달
    function showDefaultCompleteModal(req, selectEle) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';
        overlay.style.zIndex = '9999';

        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 400px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
                <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 20px 24px;">
                    <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">${req.category} 처리 완료</h2>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <p style="margin-bottom: 10px; font-weight: 600; font-size: 0.95rem; color: var(--text-main);">처리 내역(사유)을 입력하세요:</p>
                    <input type="text" id="defaultProgInput" style="width:100%; padding:10px; border: 1px solid var(--border-color); border-radius: 6px; font-family: inherit; font-size: 0.9rem; margin-bottom: 15px;" placeholder="처리 내역을 입력하세요.">
                    
                    <p style="margin-bottom: 8px; font-weight: 600; font-size: 0.95rem; color: var(--text-main);">해결 과정 (선택사항)</p>
                    <textarea id="defaultProgResolution" rows="3" style="width:100%; padding:10px; border: 1px solid var(--border-color); border-radius: 6px; resize: vertical; font-family: inherit; font-size: 0.9rem;" placeholder="어떻게 해결했는지 과정을 간략히 적어주세요."></textarea>
                    
                    <div style="margin-top:20px; text-align:right;">
                        <button id="defaultProgCancel" style="padding: 8px 16px; border: none; border-radius: 6px; background-color: #e2e8f0; color: #475569; cursor: pointer; margin-right: 8px; font-family: inherit; font-size: 0.95rem; font-weight: 600; transition: background 0.2s;">취소</button>
                        <button id="defaultProgSave" style="padding: 8px 16px; border: none; border-radius: 6px; background-color: var(--primary); color: white; cursor: pointer; font-family: inherit; font-size: 0.95rem; font-weight: 600; transition: filter 0.2s;">저장</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const inp = overlay.querySelector('#defaultProgInput');
        inp.focus();

        const closeOverlay = () => {
            selectEle.value = req.status; // Revert
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', escListener);
        };

        const escListener = (e) => {
            if (e.key === 'Escape') closeOverlay();
        };
        document.addEventListener('keydown', escListener);

        overlay.querySelector('#defaultProgCancel').onclick = closeOverlay;

        overlay.querySelector('#defaultProgSave').onclick = async () => {
            const reason = inp.value.trim();
            if (!reason) {
                alert('처리 내역(사유)을 입력해주세요.');
                return;
            }
            document.removeEventListener('keydown', escListener);
            req.completeReason = reason;

            const resolution = overlay.querySelector('#defaultProgResolution').value.trim();
            if (resolution) req.resolution = resolution;
            else delete req.resolution;

            req.rejectReason = '';
            req.status = '완료';
            await saveDataAsync();
            selectEle.className = 'status-select status-완료';
            selectEle.value = '완료';
            if (isAdmin) updateReport();
            document.body.removeChild(overlay);
        };
    }

    window.changeStatus = async function (id, selectEle) {
        if (!isAdmin) return; // 보안
        const newStatus = selectEle.value;
        const req = requests.find(r => r.id === id);
        if (req) {
            if (newStatus === '반려') {
                showRejectModal(req, selectEle);
                return;
            } else {
                req.rejectReason = '';
            }

            if (newStatus === '완료') {
                if (CAETGORY_OPTIONS[req.category]) {
                    showCompleteModal(
                        req,
                        selectEle,
                        `${req.category} 내역`,
                        `해당 내역을 선택해주세요:`,
                        CAETGORY_OPTIONS[req.category]
                    );
                    return;
                } else {
                    showDefaultCompleteModal(req, selectEle);
                    return;
                }
            } else {
                req.completeReason = '';
            }

            req.status = newStatus;
            await saveDataAsync();
            selectEle.className = `status-select status-${newStatus}`;

            if (isAdmin) updateReport();
        }
    };

    window.deleteReq = async function (id) {
        if (!isAdmin) return;
        if (confirm('해당 문의 내역을 삭제할까요?')) {
            requests = requests.filter(r => r.id !== id);
            await saveDataAsync();
            renderTable();
        }
    };

    function updateReport() {
        if (!isAdmin) return;
        const pubReqs = requests;
        const total = pubReqs.length;
        const completed = pubReqs.filter(r => r.status === '완료').length;
        const inProgress = pubReqs.filter(r => ['접수', '처리중', '보류'].includes(r.status)).length;
        const rejected = pubReqs.filter(r => r.status === '반려').length;

        const rate = total === 0 ? 0 : ((completed / total) * 100).toFixed(1);

        document.getElementById('repTotal').textContent = total + "건";
        document.getElementById('repCompleted').textContent = completed + "건";
        document.getElementById('repInProgress').textContent = inProgress + "건";
        document.getElementById('repRejected').textContent = rejected + "건";
        document.getElementById('repRate').textContent = rate + "%";

        const catCounts = requests.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
            return acc;
        }, {});

        const catsUl = document.getElementById('repCategories');
        if (catsUl) {
            catsUl.innerHTML = `
                <li style="cursor:pointer;" onclick="showCategoryRank('고장/오류')" title="클릭하여 상세 처리 내역 확인"><strong>고장/오류:</strong> <span class="bg-blue-light tag" style="float:right;">${catCounts['고장/오류'] || 0}건</span></li>
                <li style="cursor:pointer;" onclick="showCategoryRank('프로그램 설치')" title="클릭하여 상세 처리 내역 확인"><strong>프로그램 설치:</strong> <span class="bg-blue-light tag" style="float:right;">${catCounts['프로그램 설치'] || 0}건</span></li>
                <li style="cursor:pointer;" onclick="showCategoryRank('소모품 필요')" title="클릭하여 상세 처리 내역 확인"><strong>소모품 필요:</strong> <span class="bg-blue-light tag" style="float:right;">${catCounts['소모품 필요'] || 0}건</span></li>
            `;
        }

        const teamCounts = requests.reduce((acc, curr) => {
            acc[curr.team] = (acc[curr.team] || 0) + 1;
            return acc;
        }, {});

        const sortedTeams = Object.entries(teamCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const teamsOl = document.getElementById('repTeams');
        if (teamsOl) {
            if (sortedTeams.length > 0) {
                teamsOl.innerHTML = sortedTeams.map(([team, count]) => `<li style="cursor: pointer;" onclick="showTeamRank('${team}')" title="클릭하여 부서 내 요청자 순위 및 횟 확인">${team}: <strong>${count}건</strong></li>`).join('');
            } else {
                teamsOl.innerHTML = '<li>데이터가 없습니다.</li>';
            }
        }
    }

    const modalOverlay = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    const btnCloseModal = document.getElementById('btnCloseModal');

    window.showCategoryRank = function (catName) {
        if (!isAdmin) return;
        const catReqs = requests.filter(r => r.category === catName && r.status === '완료' && r.completeReason);

        const reasonCounts = catReqs.reduce((acc, curr) => {
            acc[curr.completeReason] = (acc[curr.completeReason] || 0) + 1;
            return acc;
        }, {});

        const sortedReasons = Object.entries(reasonCounts)
            .sort((a, b) => b[1] - a[1]);

        let htmlContent = `<ul style="list-style: none; padding: 0; margin-top: 10px;">`;
        if (sortedReasons.length === 0) {
            htmlContent += `<li>완료된 상세 처리 내역이 없습니다.</li>`;
        } else {
            sortedReasons.forEach((p, idx) => {
                htmlContent += `<li style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.05rem;"><strong>${idx + 1}위:</strong> <span style="margin-left:8px;">${p[0]}</span></span> 
                    <span class="tag" style="background-color: var(--primary-light); color: var(--primary); font-weight: bold; padding: 6px 12px;">${p[1]}건</span>
                </li>`;
            });
        }
        htmlContent += `</ul>`;

        document.querySelector('#detailModal .modal-header h2').textContent = `📊 [${catName}] 상세 처리 내역 순위`;
        document.getElementById('modalBody').innerHTML = htmlContent;
        document.getElementById('detailModal').classList.add('show');
    };

    window.showTeamRank = function (teamName) {
        if (!isAdmin) return;
        const teamRequests = requests.filter(r => r.team === teamName);
        const personCounts = teamRequests.reduce((acc, curr) => {
            acc[curr.name] = (acc[curr.name] || 0) + 1;
            return acc;
        }, {});

        const sortedPersons = Object.entries(personCounts)
            .sort((a, b) => b[1] - a[1]);

        let htmlContent = `<ul style="list-style: none; padding: 0; margin-top: 10px;">`;
        sortedPersons.forEach((p, idx) => {
            htmlContent += `<li style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.05rem;"><strong>${idx + 1}위:</strong> <i class="fa-solid fa-user" style="color: var(--text-muted); margin-left:8px;"></i> ${p[0]}님</span> 
                <span class="tag" style="background-color: var(--primary-light); color: var(--primary); font-weight: bold; padding: 6px 12px;">${p[1]}건</span>
            </li>`;
        });
        htmlContent += `</ul>`;

        document.querySelector('#detailModal .modal-header h2').textContent = `📊 [${teamName}] 요청자별 문의 순위`;
        document.getElementById('modalBody').innerHTML = htmlContent;
        document.getElementById('detailModal').classList.add('show');
    };

    window.openDetailModal = function (id) {
        document.querySelector('#detailModal .modal-header h2').textContent = `문의 상세 정보`;
        const req = requests.find(r => r.id === id);
        if (!req) return;

        let progressWidth = '0%';
        let s1 = 'active', s2 = '', s3 = '';
        let c2 = '', c3 = '';
        let i2 = 'fa-ellipsis', i3 = 'fa-ellipsis';

        if (req.status === '접수') {
            progressWidth = '0%';
        } else if (req.status === '처리중') {
            progressWidth = '50%';
            s2 = 'active';
            i2 = 'fa-spinner fa-spin';
        } else if (req.status === '보류') {
            progressWidth = '50%';
            s2 = 'active';
            c2 = 'active-warning';
            i2 = 'fa-pause';
        } else if (req.status === '완료') {
            progressWidth = '100%';
            s2 = 'active'; s3 = 'active';
            c2 = 'active-success'; c3 = 'active-success';
            i2 = 'fa-check'; i3 = 'fa-check';
        } else if (req.status === '반려') {
            progressWidth = '100%';
            s2 = 'active'; s3 = 'active';
            c2 = 'active-danger'; c3 = 'active-danger';
            i2 = 'fa-xmark'; i3 = 'fa-xmark';
        }

        let lineColor = 'var(--primary)';
        if (req.status === '완료') lineColor = 'var(--secondary)';
        if (req.status === '반려') lineColor = 'var(--danger)';
        if (req.status === '보류') lineColor = 'var(--warning)';

        const stepHtml = `
            <div class="step-indicator">
                <div class="step-line" style="width: calc(${progressWidth} * 0.9); background-color: ${lineColor};"></div>
                <div class="step ${s1}">
                    <div class="step-icon"><i class="fa-solid fa-inbox"></i></div>
                    <span class="step-text">접수</span>
                </div>
                <div class="step ${s2} ${c2}">
                    <div class="step-icon"><i class="fa-solid ${i2}"></i></div>
                    <span class="step-text">${req.status === '보류' ? '보류' : '처리중'}</span>
                </div>
                <div class="step ${s3} ${c3}">
                    <div class="step-icon"><i class="fa-solid ${i3}"></i></div>
                    <span class="step-text">${req.status === '반려' ? '반려' : '완료'}</span>
                </div>
            </div>
        `;

        const dateStr = new Date(req.date).toLocaleDateString() + " " + new Date(req.date).toLocaleTimeString();

        let rejectHtml = '';
        if (req.status === '반려' && req.rejectReason) {
            rejectHtml = `<div class="detail-row"><span class="detail-label" style="color: var(--danger);">반려 사유</span> <span class="detail-value" style="color: var(--danger); font-weight: 600;">${req.rejectReason}</span></div>`;
        } else if (req.status === '완료' && req.completeReason) {
            let resHtml = '';
            if (req.resolution) {
                resHtml = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color); color: var(--text-muted); font-size: 0.9rem;"><strong style="color: var(--text-main);">해결 과정:</strong><br>${req.resolution}</div>`;
            }
            rejectHtml = `<div class="detail-row"><span class="detail-label" style="color: var(--secondary);">처리 내역</span> <span class="detail-value" style="color: var(--secondary); font-weight: 600;">${req.completeReason}${resHtml}</span></div>`;
        }

        let imagesHtml = '';
        if (req.images && req.images.length > 0) {
            const imgs = req.images.map(imgData => `<img src="${imgData}">`).join('');
            imagesHtml = `<div class="detail-row" style="flex-direction:column; align-items:flex-start;"><span class="detail-label" style="margin-bottom:8px;">첨부 이미지 (<i class="fa-solid fa-paperclip"></i> ${req.images.length}장)</span> <div class="detail-images" style="width:100%; margin-top:8px;">${imgs}</div></div>`;
        }

        // 첨부 파일(드라이브 업로드) 링크 렌더링
        let filesHtml = '';
        if (req.fileAttachments && req.fileAttachments.length > 0) {
            const fileLinks = req.fileAttachments.map(f => {
                const ext = f.name.split('.').pop().toLowerCase();
                let iconColor = '#7f8c8d';
                let iconClass = 'fa-file';
                if (ext === 'pdf') {
                    iconColor = '#e74c3c';
                    iconClass = 'fa-file-pdf';
                } else if (['xls','xlsx','xlsb','xlsm','csv'].includes(ext)) {
                    iconColor = '#27ae60';
                    iconClass = 'fa-file-excel';
                } else if (['ppt','pptx','ppsx'].includes(ext)) {
                    iconColor = '#e67e22';
                    iconClass = 'fa-file-powerpoint';
                } else if (['doc','docx'].includes(ext)) {
                    iconColor = '#2980b9';
                    iconClass = 'fa-file-word';
                } else if (['hwp','hwpx'].includes(ext)) {
                    iconColor = '#1abc9c';
                    iconClass = 'fa-file-word';
                } else if (['zip','rar','7z'].includes(ext)) {
                    iconColor = '#8e44ad';
                    iconClass = 'fa-file-zipper';
                } else if (ext === 'txt') {
                    iconColor = '#7f8c8d';
                    iconClass = 'fa-file-lines';
                }
                return `<a href="${f.url}" target="_blank" style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:#f8fafc; border:1px solid var(--border-color); border-radius:8px; text-decoration:none; color:var(--text-main); font-size:0.9rem; transition:background 0.2s;" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='#f8fafc'">
                    <i class="fa-solid ${iconClass}" style="color:${iconColor}; font-size:1.1rem;"></i>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
                    <i class="fa-solid fa-external-link-alt" style="color:var(--text-muted); font-size:0.8rem;"></i>
                </a>`;
            }).join('');
            filesHtml = `<div class="detail-row" style="flex-direction:column; align-items:flex-start;">
                <span class="detail-label" style="margin-bottom:8px;"><i class="fa-solid fa-paperclip"></i> 첨부 파일 (${req.fileAttachments.length}개)</span>
                <div style="width:100%; display:flex; flex-direction:column; gap:6px; margin-top:4px;">${fileLinks}</div>
            </div>`;
        }

        modalBody.innerHTML = `
            <div class="detail-row"><span class="detail-label">No</span> <span class="detail-value">${req.id}</span></div>
            <div class="detail-row"><span class="detail-label">요청자</span> <span class="detail-value">${req.name}</span></div>
            <div class="detail-row"><span class="detail-label">소속 팀</span> <span class="detail-value">${req.team}</span></div>
            <div class="detail-row"><span class="detail-label">사내메일</span> <span class="detail-value">${req.email || '-'}</span></div>
            <div class="detail-row"><span class="detail-label">카테고리</span> <span class="detail-value">${req.category}</span></div>
            <div class="detail-row"><span class="detail-label">문의 제목</span> <span class="detail-value" style="font-weight: 600;">${req.title || '-'}</span></div>
            <div class="detail-row"><span class="detail-label">상세 내용</span> <span class="detail-value" style="white-space: pre-wrap;">${req.desc}</span></div>
            ${imagesHtml}
            ${filesHtml}
            <div class="detail-row"><span class="detail-label">접수 일자</span> <span class="detail-value">${dateStr}</span></div>
            <div class="detail-row"><span class="detail-label">현재 상태</span> <span class="detail-value"><span class="tag status-${req.status}">${req.status}</span></span></div>
            ${rejectHtml}
            <div class="detail-row" style="flex-direction: column; align-items: flex-start; border-bottom: none;">
                <span class="detail-label" style="margin-bottom: 12px; width: 100%;">진행률</span> 
                ${stepHtml}
            </div>
            <!-- 일반 사용자의 경우, 본인이 작성한 글인 경우에만 상세 모달 하단에 수정/삭제 단추 노출 -->
            ${(userRole === 'user' && req.email === sessionStorage.getItem('itUserEmail')) ? `
            <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" onclick="handleUserEditRequest(${req.id})" style="padding: 8px 16px; border: 1px solid var(--border-color); border-radius: 4px; background-color: white; color: var(--text-color); cursor: pointer; font-weight: 500;">수정</button>
                <button type="button" onclick="handleUserDeleteRequest(${req.id})" style="padding: 8px 16px; border: 1px solid #fecaca; border-radius: 4px; background-color: #fef2f2; color: var(--danger); cursor: pointer; font-weight: 500;">삭제</button>
            </div>
            ` : ''}
        `;
        modalOverlay.classList.add('show');
    };

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modalOverlay.classList.remove('show');
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('show');
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // id가 있는 모든 정적 모달 중 현재 열려있는(show 클래스가 있는) 모달을 찾아 닫습니다.
            document.querySelectorAll('.modal-overlay.show').forEach(modal => {
                if (modal.id) {
                    modal.classList.remove('show');
                }
            });
        }
    });

    // 문서 초기 렌더링 시 서버에서 데이터 최초 로드
    loadData();

    // === 일반 사용자 본인 글 비밀번호 없는 즉시 수정/삭제 제어 ===
    window.handleUserEditRequest = function(id) {
        const req = requests.find(r => r.id == id);
        if (!req) return;
        
        modalOverlay.classList.remove('show');
        
        // 수정 모드 진입
        document.querySelector('.nav-links a[data-target="page-request"]').click();
        document.getElementById('pageRequestTitle').textContent = '전산 문의 수정';
        const descEl = document.getElementById('pageRequestDesc');
        if (descEl) {
            descEl.textContent = '등록하신 문의 내용을 수정합니다.';
        }
        document.getElementById('editReqId').value = req.id;
        document.getElementById('reqName').value = req.name;
        
        const reqTeamEl = document.getElementById('reqTeam');
        if (reqTeamEl) {
            reqTeamEl.value = req.team;
        }
        
        if (req.email) {
            document.getElementById('reqEmailId').value = req.email.replace('@swei.co.kr', '');
        } else {
            document.getElementById('reqEmailId').value = '';
        }
        document.getElementById('reqCategory').value = req.category;
        document.getElementById('reqTitle').value = req.title || '';
        document.getElementById('reqDesc').value = req.desc;
        
        attachedImages = req.images ? [...req.images] : [];
        renderImagePreviews();
        // 수정 모드 진입 시 기존 첨부 파일 복원
        attachedFiles = req.fileAttachments ? req.fileAttachments.map(f => ({ ...f, status: 'done', mimeType: '', base64: '' })) : [];
        if (window.renderFilePreviews) window.renderFilePreviews();

        document.getElementById('btnSubmitRequest').innerHTML = '<i class="fa-solid fa-check"></i> 수정 완료';
        const btnCancel = document.getElementById('btnCancelEdit');
        if (btnCancel) btnCancel.style.display = 'inline-block';
    };

    window.handleUserDeleteRequest = async function(id) {
        const req = requests.find(r => r.id == id);
        if (!req) return;
        
        modalOverlay.classList.remove('show');
        if (confirm('정말 이 문의를 삭제하시겠습니까?')) {
            requests = requests.filter(r => r.id != id);
            const success = await saveDataAsync();
            if (success) {
                renderTable();
                alert('삭제되었습니다.');
            }
        }
    };

    // === 관리자 계정 추가 로직 ===
    const btnShowAddAdminModal = document.getElementById('btnShowAddAdminModal');
    const adminRegModal = document.getElementById('adminRegModal');
    const btnCloseAdminRegModal = document.getElementById('btnCloseAdminRegModal');
    const adminRegForm = document.getElementById('adminRegForm');

    if (btnShowAddAdminModal) {
        btnShowAddAdminModal.addEventListener('click', (e) => {
            e.preventDefault();
            adminRegForm.reset();
            adminRegModal.classList.add('show');
        });
    }

    if (btnCloseAdminRegModal) {
        btnCloseAdminRegModal.addEventListener('click', () => {
            adminRegModal.classList.remove('show');
        });
    }

    if (adminRegForm) {
        adminRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const realName = document.getElementById('newAdminRealName').value.trim();
            const id = document.getElementById('newAdminId').value.trim();
            const pw = document.getElementById('newAdminPw').value;
            const pwConfirm = document.getElementById('newAdminPwConfirm').value;
            const email = document.getElementById('newAdminEmail').value.trim();

            if (pw !== pwConfirm) {
                alert('비밀번호가 서로 일치하지 않습니다.');
                return;
            }

            // 아이디와 패스워드를 결합하여 해싱 (서버 사이드 일치 규칙)
            const encoder = new TextEncoder();
            const data = encoder.encode(id + ":" + pw);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            let success = false;
            showLoading();
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    alert('구글 스크립트가 연동되지 않아 로컬에서는 관리자를 추가할 수 없습니다.');
                } else {
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'addAdmin',
                            username: id,
                            name: realName,
                            password: hashHex,
                            email: email
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            success = true;
                        }
                    }
                }
            } catch (err) {
                console.error('관리자 추가 실패:', err);
                alert('관리자 추가 중 네트워크 오류가 발생했습니다.');
            } finally {
                hideLoading();
            }

            if (success) {
                alert('새 관리자 계정이 성공적으로 추가되었습니다!');
                adminRegModal.classList.remove('show');
                loadAdminList(); // 추가 성공 시 목록 갱신
            }
        });
    }

    // === 관리자 계정 정보 수정 로직 ===
    const adminEditModal = document.getElementById('adminEditModal');
    const btnCloseAdminEditModal = document.getElementById('btnCloseAdminEditModal');
    const adminEditForm = document.getElementById('adminEditForm');

    if (btnCloseAdminEditModal) {
        btnCloseAdminEditModal.addEventListener('click', () => {
            adminEditModal.classList.remove('show');
        });
    }

    window.openEditAdminModal = function(id, name, username, email) {
        document.getElementById('editAdminId').value = id;
        document.getElementById('editAdminRealName').value = name;
        document.getElementById('editAdminUsername').value = username;
        document.getElementById('editAdminEmail').value = email;
        adminEditModal.classList.add('show');
    };

    if (adminEditForm) {
        adminEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminId = document.getElementById('editAdminId').value;
            const realName = document.getElementById('editAdminRealName').value.trim();
            const username = document.getElementById('editAdminUsername').value.trim();
            const email = document.getElementById('editAdminEmail').value.trim();

            let success = false;
            showLoading();
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    alert('구글 스크립트가 연동되지 않아 로컬에서는 관리자 정보를 수정할 수 없습니다.');
                } else {
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'updateAdminInfo',
                            adminId: adminId,
                            username: username,
                            name: realName,
                            email: email
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            success = true;
                        } else {
                            alert(result.message || '관리자 정보 수정 실패');
                        }
                    }
                }
            } catch (err) {
                console.error('관리자 정보 수정 실패:', err);
                alert('관리자 정보 수정 중 네트워크 오류가 발생했습니다.');
            } finally {
                hideLoading();
            }

            if (success) {
                alert('관리자 정보가 성공적으로 수정되었습니다.');
                adminEditModal.classList.remove('show');
                loadAdminList(); // 목록 갱신
            }
        });
    }

    // === 관리자 목록 로드 및 렌더링 ===
    window.loadAdminList = async function() {
        if (!GOOGLE_SCRIPT_URL) {
            console.warn('구글 스크립트 연동 해제 상태 - 관리자 목록을 조회할 수 없습니다.');
            return;
        }
        showLoading();
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'getAdmins' })
            });
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    renderAdminList(result.admins || []);
                } else {
                    alert('관리자 목록 조회 실패: ' + result.message);
                }
            }
        } catch (err) {
            console.error('관리자 목록 조회 중 오류:', err);
            alert('관리자 목록 조회 중 네트워크 오류가 발생했습니다.');
        } finally {
            hideLoading();
        }
    };

    function renderAdminList(admins) {
        const tbody = document.querySelector('#adminListTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (admins.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">등록된 관리자가 없습니다.</td></tr>`;
            return;
        }

        admins.forEach((admin, index) => {
            const tr = document.createElement('tr');
            
            // 등록일시 포맷팅 (KST 문자열 파싱)
            let dateStr = '-';
            if (admin.date) {
                try {
                    const d = new Date(admin.date);
                    dateStr = d.toLocaleDateString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });
                } catch(e) {
                    dateStr = admin.date;
                }
            }

            // 마스터 계정은 삭제 불가 (ID 1번 기준)
            const isMaster = Number(admin.id) === 1;
            
            const editBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: #4f46e5; color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="openEditAdminModal(${admin.id}, '${admin.name || ''}', '${admin.username || ''}', '${admin.email || ''}')"><i class="fa-solid fa-user-gear"></i> 수정</button>`;
            const changePwBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: var(--primary); color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="promptChangePassword(${admin.id}, '${admin.username}')"><i class="fa-solid fa-key"></i> 변경</button>`;
            const deleteBtnHtml = isMaster 
                ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500; white-space: nowrap; padding: 6px 10px;">마스터 계정</span>`
                : `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: #ef4444; color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="deleteAdminAccount(${admin.id}, '${admin.name}')"><i class="fa-solid fa-trash"></i> 삭제</button>`;

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${admin.name || '-'}</strong></td>
                <td><code>${admin.username || '-'}</code></td>
                <td>${admin.email || '-'}</td>
                <td>${dateStr}</td>
                <td>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:nowrap;">
                        ${editBtnHtml}
                        ${changePwBtnHtml}
                        ${deleteBtnHtml}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.deleteAdminAccount = async function(adminId, adminRealName) {
        if (confirm(`정말 관리자 계정 [${adminRealName}]을(를) 영구 삭제하시겠습니까?`)) {
            showLoading();
            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'deleteAdmin',
                        adminId: adminId
                    })
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success') {
                        alert(`관리자 계정 [${adminRealName}]이(가) 정상적으로 삭제되었습니다.`);
                        loadAdminList(); // 삭제 후 목록 갱신
                    } else {
                        alert('계정 삭제 실패: ' + result.message);
                    }
                }
            } catch (err) {
                console.error('관리자 삭제 오류:', err);
                alert('관리자 계정 삭제 중 네트워크 오류가 발생했습니다.');
            } finally {
                hideLoading();
            }
        }
    };

    // === 관리자 비밀번호 변경 처리 ===
    const changePasswordModal = document.getElementById('changePasswordModal');
    const btnCloseChangePasswordModal = document.getElementById('btnCloseChangePasswordModal');
    const changePasswordForm = document.getElementById('changePasswordForm');

    window.promptChangePassword = function(id, username) {
        if (changePasswordForm) changePasswordForm.reset();
        document.getElementById('changePasswordAdminId').value = id;
        document.getElementById('changePasswordUsername').value = username;
        document.getElementById('changePasswordTargetId').value = username;
        if (changePasswordModal) changePasswordModal.classList.add('show');
    };

    if (btnCloseChangePasswordModal) {
        btnCloseChangePasswordModal.addEventListener('click', () => {
            if (changePasswordModal) changePasswordModal.classList.remove('show');
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('changePasswordAdminId').value;
            const username = document.getElementById('changePasswordUsername').value;
            const newPw = document.getElementById('newChangePassword').value;
            const newPwConfirm = document.getElementById('newChangePasswordConfirm').value;

            if (newPw !== newPwConfirm) {
                alert('비밀번호가 서로 일치하지 않습니다.');
                return;
            }

            // 새 비밀번호 해싱 (아이디 + ":" + 새 비밀번호)
            const encoder = new TextEncoder();
            const data = encoder.encode(username + ":" + newPw);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            let success = false;
            showLoading();
            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'changeAdminPassword',
                        adminId: id,
                        newPasswordHash: hashHex
                    })
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success') {
                        success = true;
                    } else {
                        alert('비밀번호 변경 실패: ' + result.message);
                    }
                }
            } catch (err) {
                console.error('비밀번호 변경 중 네트워크 오류:', err);
                alert('비밀번호 변경 중 오류가 발생했습니다.');
            } finally {
                hideLoading();
            }

            if (success) {
                alert('관리자 비밀번호가 성공적으로 변경되었습니다!');
                if (changePasswordModal) changePasswordModal.classList.remove('show');
                loadAdminList(); // 완료 후 목록 갱신
            }
        });
    }

    // ==========================================
    // 챗봇 (Chatbot) 가이드 로직 구현
    // ==========================================
    const quickReplies = document.getElementById('quickReplies');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const btnSendChat = document.getElementById('btnSendChat');

    // 퀵 리플라이 버튼 동적 렌더링
    function renderQuickReplies() {
        if (!quickReplies) return;
        quickReplies.innerHTML = '';
        
        chatbotGuides.forEach(guide => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-quick';
            btn.setAttribute('data-keyword', guide.key);
            
            // 제목에서 이모지 포함하여 깔끔하게 '해결법' 제거 후 표시
            let displayTitle = guide.title.replace(/해결법$/, '').trim();
            btn.textContent = displayTitle;
            quickReplies.appendChild(btn);
        });
    }

    // 챗봇 데이터 모델 포맷터 (동적 데이터 형식 지원)
    function formatBotResponse(data) {
        let html = `<p><strong>${data.title}</strong></p>`;
        html += `<p>스스로 해결해 볼 수 있는 조치 순서입니다.</p>`;
        html += `<ol style="margin-top: 8px; margin-bottom: 8px; padding-left: 20px;">`;
        if (Array.isArray(data.steps)) {
            data.steps.forEach((step) => {
                html += `<li style="margin-bottom: 6px;">${step}</li>`;
            });
        }
        html += `</ol>`;

        const dls = data.downloads || [];
        if (dls.length > 0) {
            dls.forEach((dl) => {
                html += `
                    <div style="margin: 12px 0; padding: 14px; background-color: var(--primary-light); border: 1px solid var(--primary); border-radius: 8px; font-size: 0.9rem; color: var(--text-main);">
                        <p style="font-weight: 600; color: var(--primary); margin-bottom: 8px;"><i class="fa-solid fa-screwdriver-wrench"></i> ${dl.title || '원클릭 자동 해결 도구'}</p>
                        <a href="${dl.file}" download style="display: inline-flex; align-items: center; gap: 8px; background-color: var(--primary); color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-bottom: 10px; transition: var(--transition);" onmouseover="this.style.backgroundColor='#4338CA'" onmouseout="this.style.backgroundColor='var(--primary)'">
                            <i class="fa-solid fa-download"></i> ${dl.text}
                        </a>
                        <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;"><i class="fa-solid fa-circle-exclamation" style="color:var(--warning);"></i> ${dl.guide}</p>
                    </div>
                `;
            });
        }

        if (data.tip) {
            html += `<p style="margin-top: 10px; padding: 10px; background-color: #F1F5F9; border-radius: 6px; font-size: 0.88rem; color: var(--text-muted);"><i class="fa-solid fa-circle-info" style="color:var(--primary); margin-right: 4px;"></i> <strong>Tip:</strong> ${data.tip}</p>`;
        }
        
        // 하단 추가 액션 제공
        html += `
            <div style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="#" class="chat-action-link" id="chatLinkToRequest" data-guide-title="${data.title || ''}" data-guide-key="${data.key || ''}"><i class="fa-solid fa-circle-question"></i> 해결되지 않음 (문의 접수하기)</a>
            </div>
        `;
        return html;
    }

    // 챗봇 입력 전송 함수
    async function sendUserMessage(text) {
        if (!text.trim()) return;

        // 1. 사용자 말풍선 추가
        appendMessage('user', text);
        chatInput.value = '';

        // 2. 타이핑 중 인디케이터 표시
        const typingId = showTypingIndicator();

        try {
            // 3. 챗봇 자동 답변 생성 (비동기 처리)
            const replyHtml = await getBotResponse(text);
            removeTypingIndicator(typingId);
            appendMessage('bot', replyHtml);
        } catch (err) {
            removeTypingIndicator(typingId);
            appendMessage('bot', `<p>⚠️ 오류가 발생했습니다: ${err.message || err}</p>`);
        }
    }

    // 채팅창 메시지 추가 함수
    function appendMessage(sender, content) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;

        let innerHTML = '';
        if (sender === 'bot') {
            innerHTML += `<div class="avatar"><i class="fa-solid fa-robot"></i></div>`;
        }

        innerHTML += `
            <div class="msg-content">
                ${content}
            </div>
        `;
        msgDiv.innerHTML = innerHTML;
        chatMessages.appendChild(msgDiv);
        
        // 스크롤 최하단으로 이동
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 타이핑 인디케이터 표시
    function showTypingIndicator() {
        if (!chatMessages) return null;
        const indicatorDiv = document.createElement('div');
        const uniqueId = 'typing-' + Date.now();
        indicatorDiv.className = 'message bot typing-indicator-wrapper';
        indicatorDiv.id = uniqueId;
        indicatorDiv.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="msg-content" style="padding: 10px 14px;">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(indicatorDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return uniqueId;
    }

    // 타이핑 인디케이터 제거
    function removeTypingIndicator(id) {
        if (!id) return;
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.remove();
        }
    }

    // 메시지 텍스트 분석 및 최적 답변 매핑 (동적 키워드 분석)
    async function getBotResponse(inputText) {
        const query = inputText.toLowerCase().replace(/\s+/g, '');
        
        let matchedGuide = null;
        // 1단계: 식별 키 매칭
        for (const guide of chatbotGuides) {
            if (query.includes(guide.key.toLowerCase())) {
                matchedGuide = guide;
                break;
            }
        }
        // 2단계: 가이드 제목 유사도 매칭
        if (!matchedGuide) {
            for (const guide of chatbotGuides) {
                const cleanTitle = guide.title.replace(/[^ㄱ-ㅎ가-힣a-zA-Z0-9]/g, '').toLowerCase();
                const cleanInput = query.replace(/[^ㄱ-ㅎ가-힣a-zA-Z0-9]/g, '');
                if (cleanInput.includes(cleanTitle) || cleanTitle.includes(cleanInput)) {
                    matchedGuide = guide;
                    break;
                }
            }
        }
        // 3단계: 해결 단계 내의 텍스트 매칭
        if (!matchedGuide) {
            for (const guide of chatbotGuides) {
                const stepsStr = (guide.steps || []).join('').replace(/[^ㄱ-ㅎ가-힣a-zA-Z0-9]/g, '').toLowerCase();
                if (query.length >= 3 && stepsStr.includes(query)) {
                    matchedGuide = guide;
                    break;
                }
            }
        }
        
        if (matchedGuide) {
            return formatBotResponse(matchedGuide);
        }

        // 폴백 가이드 목록 렌더링
        let htmlList = `<div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">`;
        chatbotGuides.forEach(g => {
            htmlList += `<a href="#" class="chat-action-link" onclick="triggerQuickReply('${g.key}'); return false;">${g.title} 보기</a>`;
        });
        htmlList += `<a href="#" class="chat-action-link" id="chatLinkToRequest" data-query="${inputText || ''}"><i class="fa-solid fa-paper-plane"></i> IT 지원팀에 정식 문의 접수하기</a></div>`;

        return `
            <p>죄송합니다. 😢 입력하신 내용(<strong>"${inputText}"</strong>)에 맞는 자가 해결법을 찾지 못했습니다.</p>
            <p>아래 목록에서 원하시는 해결 가이드를 선택하시거나, 계속 해결이 어려운 경우 [전산 문의 접수] 탭에서 상세 내용을 접수해 주시면 담당자가 신속히 연락해 드리겠습니다.</p>
            ${htmlList}
        `;
    }

    // 퀵 리플라이 트리거 함수 (전역 바인딩)
    window.triggerQuickReply = function(keyword) {
        const guide = chatbotGuides.find(g => g.key === keyword);
        if (!guide) return;
        
        appendMessage('user', guide.title);

        const typingId = showTypingIndicator();
        
        setTimeout(() => {
            removeTypingIndicator(typingId);
            const replyHtml = formatBotResponse(guide);
            appendMessage('bot', replyHtml);
        }, 600);
    };

    // 퀵 버튼 클릭 바인딩
    if (quickReplies) {
        quickReplies.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-quick');
            if (!btn) return;
            const keyword = btn.getAttribute('data-keyword');
            window.triggerQuickReply(keyword);
        });
    }

    // 입력창 엔터 및 전송 클릭 바인딩
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendUserMessage(chatInput.value);
            }
        });
    }

    if (btnSendChat) {
        btnSendChat.addEventListener('click', () => {
            sendUserMessage(chatInput.value);
        });
    }

    // 챗봇 가이드 내의 '문의 접수하기' 동적 바인딩 처리 (이벤트 위임)
    if (chatMessages) {
        chatMessages.addEventListener('click', (e) => {
            const link = e.target.closest('#chatLinkToRequest');
            if (!link) return;
            e.preventDefault();
            
            // 챗봇에서 보던 맥락 정보 수집
            const guideTitle = link.getAttribute('data-guide-title');
            const guideKey = link.getAttribute('data-guide-key');
            const queryText = link.getAttribute('data-query');
            
            // 문의 접수 탭으로 이동시킴
            const requestTab = document.querySelector('.nav-links a[data-target="page-request"]');
            if (requestTab) {
                requestTab.click();
                
                // 폼 입력 요소 가져오기
                const reqTitleEl = document.getElementById('reqTitle');
                const reqDescEl = document.getElementById('reqDesc');
                const reqCategoryEl = document.getElementById('reqCategory');
                
                if (guideTitle) {
                    if (reqTitleEl) reqTitleEl.value = `[자가조치 실패] ${guideTitle}`;
                    if (reqDescEl) {
                        reqDescEl.value = `챗봇 자가조치 가이드 ("${guideTitle}")에 기재된 조치 단계를 시도해 보았으나 해결되지 않아 문의 접수합니다.\n\n[증상 및 시도한 조치 내용]:\n- `;
                    }
                    if (reqCategoryEl) {
                        if (guideKey === 'share') {
                            reqCategoryEl.value = '권한/계정';
                        } else {
                            reqCategoryEl.value = '고장/오류';
                        }
                    }
                } else if (queryText) {
                    if (reqTitleEl) reqTitleEl.value = `[전산 문의] ${queryText} 관련`;
                    if (reqDescEl) {
                        reqDescEl.value = `챗봇에 "${queryText}" 검색어로 질의하였으나 자가 해결 가이드가 없거나 해결되지 않아 문의 드립니다.\n\n[상세 내용]:\n- `;
                    }
                    if (reqCategoryEl) {
                        reqCategoryEl.value = '고장/오류';
                    }
                }
            } else {
                alert('문의 접수 탭에 접근할 수 없습니다.');
            }
        });
    }

    // ==========================================
    // 사용자(임직원) 계정 관리 로직 구현
    // ==========================================
    const userRegModal = document.getElementById('userRegModal');
    const userEditModal = document.getElementById('userEditModal');
    const changeUserPasswordModal = document.getElementById('changeUserPasswordModal');
    
    const btnShowAddUserModal = document.getElementById('btnShowAddUserModal');
    const btnCloseUserRegModal = document.getElementById('btnCloseUserRegModal');
    const btnCloseUserEditModal = document.getElementById('btnCloseUserEditModal');
    const btnCloseChangeUserPasswordModal = document.getElementById('btnCloseChangeUserPasswordModal');
    
    const userRegForm = document.getElementById('userRegForm');
    const userEditForm = document.getElementById('userEditForm');
    const changeUserPasswordForm = document.getElementById('changeUserPasswordForm');

    // 모달 열기/닫기 이벤트 바인딩
    if (btnShowAddUserModal) {
        btnShowAddUserModal.addEventListener('click', (e) => {
            e.preventDefault();
            if (userRegForm) userRegForm.reset();
            if (userRegModal) userRegModal.classList.add('show');
        });
    }

    if (btnCloseUserRegModal) {
        btnCloseUserRegModal.addEventListener('click', () => {
            if (userRegModal) userRegModal.classList.remove('show');
        });
    }

    if (btnCloseUserEditModal) {
        btnCloseUserEditModal.addEventListener('click', () => {
            if (userEditModal) userEditModal.classList.remove('show');
        });
    }

    if (btnCloseChangeUserPasswordModal) {
        btnCloseChangeUserPasswordModal.addEventListener('click', () => {
            if (changeUserPasswordModal) changeUserPasswordModal.classList.remove('show');
        });
    }

    // 사용자 계정 조회 및 로드
    window.loadUserList = async function() {
        showLoading();
        let useLocalFallback = false;
        try {
            if (!GOOGLE_SCRIPT_URL) {
                useLocalFallback = true;
            } else {
                // 구글 시트 연동 모드
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'getUsers' })
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result && result.status === 'success') {
                        renderUserList(result.users || []);
                    } else {
                        // Unknown action 등으로 실패 시 로컬로 폴백
                        console.warn('사용자 조회 API 실패, 로컬 스토리지로 대체합니다:', result ? result.message : '응답 없음');
                        useLocalFallback = true;
                    }
                } else {
                    useLocalFallback = true;
                }
            }
        } catch (err) {
            console.error('사용자 목록 로드 중 오류, 로컬 스토리지로 대체합니다:', err);
            useLocalFallback = true;
        } finally {
            hideLoading();
        }

        if (useLocalFallback) {
            const localData = localStorage.getItem('localUsersDB');
            let users = [];
            try {
                if (localData) {
                    users = JSON.parse(localData);
                }
            } catch (e) {
                console.error('로컬 사용자 DB 파싱 에러, 초기화합니다:', e);
                users = [];
            }
            
            if (!Array.isArray(users) || users.length === 0) {
                // 초기 샘플 사용자 데이터 생성
                users = [{
                    username: 'testuser',
                    name: '테스트유저',
                    team: '전산팀',
                    email: 'testuser@swei.co.kr',
                    passwordHash: 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c' // 기본 비번 1234
                }];
                localStorage.setItem('localUsersDB', JSON.stringify(users));
            }
            renderUserList(users);
        }
    };

    // 사용자 목록 렌더링
    function renderUserList(users) {
        const tbody = document.querySelector('#userListTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">등록된 사용자가 없습니다.</td></tr>`;
            return;
        }

        users.forEach((user, index) => {
            if (!user || !user.username) return; // 무효한 데이터 스킵
            const tr = document.createElement('tr');
            
            const editBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: #4f46e5; color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="openEditUserModal('${user.username}', '${user.name || ''}', '${user.team || ''}', '${user.email || ''}')"><i class="fa-solid fa-user-gear"></i> 수정</button>`;
            const changePwBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: var(--primary); color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="promptChangeUserPassword('${user.username}')"><i class="fa-solid fa-key"></i> 변경</button>`;
            const deleteBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: #ef4444; color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="deleteUserAccount('${user.username}', '${user.name}')"><i class="fa-solid fa-trash"></i> 삭제</button>`;

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><code>${user.username}</code></td>
                <td><strong>${user.name || '-'}</strong></td>
                <td>${user.team || '-'}</td>
                <td>${user.email || '-'}</td>
                <td>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:nowrap;">
                        ${editBtnHtml}
                        ${changePwBtnHtml}
                        ${deleteBtnHtml}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 신규 사용자 등록 처리
    if (userRegForm) {
        userRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('newUserUsername').value.trim();
            const realName = document.getElementById('newUserRealName').value.trim();
            const team = document.getElementById('newUserTeam').value;
            const pw = document.getElementById('newUserPw').value;
            const pwConfirm = document.getElementById('newUserPwConfirm').value;
            const email = document.getElementById('newUserEmail').value.trim();

            if (pw !== pwConfirm) {
                alert('비밀번호가 서로 일치하지 않습니다.');
                return;
            }

            // 사번 + ":" + 비밀번호 조합 후 SHA-256 해싱
            const encoder = new TextEncoder();
            const data = encoder.encode(username + ":" + pw);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            showLoading();
            let useLocalFallback = false;
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    useLocalFallback = true;
                } else {
                    // 구글 시트 연동 모드
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'addUser',
                            username,
                            name: realName,
                            team,
                            password: hashHex,
                            email
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            alert('새 사용자 계정이 성공적으로 추가되었습니다!');
                            if (userRegModal) userRegModal.classList.remove('show');
                            loadUserList();
                        } else {
                            console.warn('사용자 추가 API 실패, 로컬 스토리지에 기록합니다:', result.message);
                            useLocalFallback = true;
                        }
                    } else {
                        useLocalFallback = true;
                    }
                }
            } catch (err) {
                console.error('사용자 추가 중 오류, 로컬 스토리지에 기록합니다:', err);
                useLocalFallback = true;
            } finally {
                hideLoading();
            }

            if (useLocalFallback) {
                const localUsers = JSON.parse(localStorage.getItem('localUsersDB') || '[]');
                if (localUsers.some(u => u.username === username)) {
                    alert('이미 존재하는 사원 ID입니다.');
                    return;
                }
                localUsers.push({
                    username,
                    name: realName,
                    team,
                    email,
                    passwordHash: hashHex
                });
                localStorage.setItem('localUsersDB', JSON.stringify(localUsers));
                alert('새 사용자 계정이 로컬 저장소에 추가되었습니다! (배포되지 않은 API 모드)');
                if (userRegModal) userRegModal.classList.remove('show');
                loadUserList();
            }
        });
    }

    // 사용자 정보 수정 모달 팝업
    window.openEditUserModal = function(username, name, team, email) {
        document.getElementById('editUserOldUsername').value = username;
        document.getElementById('editUserUsername').value = username;
        document.getElementById('editUserRealName').value = name;
        document.getElementById('editUserTeam').value = team;
        document.getElementById('editUserEmail').value = email;
        if (userEditModal) userEditModal.classList.add('show');
    };

    // 사용자 정보 수정 처리
    if (userEditForm) {
        userEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldUsername = document.getElementById('editUserOldUsername').value;
            const username = document.getElementById('editUserUsername').value.trim();
            const realName = document.getElementById('editUserRealName').value.trim();
            const team = document.getElementById('editUserTeam').value;
            const email = document.getElementById('editUserEmail').value.trim();

            showLoading();
            let useLocalFallback = false;
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    useLocalFallback = true;
                } else {
                    // 구글 시트 연동 모드
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'updateUserInfo',
                            oldUsername,
                            username,
                            name: realName,
                            team,
                            email
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            alert('사용자 정보가 성공적으로 수정되었습니다.');
                            if (userEditModal) userEditModal.classList.remove('show');
                            loadUserList();
                        } else {
                            console.warn('사용자 정보 수정 API 실패, 로컬 스토리지에 기록합니다:', result.message);
                            useLocalFallback = true;
                        }
                    } else {
                        useLocalFallback = true;
                    }
                }
            } catch (err) {
                console.error('사용자 정보 수정 중 오류, 로컬 스토리지에 기록합니다:', err);
                useLocalFallback = true;
            } finally {
                hideLoading();
            }

            if (useLocalFallback) {
                const localUsers = JSON.parse(localStorage.getItem('localUsersDB') || '[]');
                if (username !== oldUsername && localUsers.some(u => u.username === username)) {
                    alert('이미 존재하는 사원 ID입니다.');
                    return;
                }
                const userIndex = localUsers.findIndex(u => u.username === oldUsername);
                if (userIndex !== -1) {
                    localUsers[userIndex].username = username;
                    localUsers[userIndex].name = realName;
                    localUsers[userIndex].team = team;
                    localUsers[userIndex].email = email;
                    localStorage.setItem('localUsersDB', JSON.stringify(localUsers));
                    alert('사용자 정보가 로컬 저장소에 수정되었습니다! (배포되지 않은 API 모드)');
                    if (userEditModal) userEditModal.classList.remove('show');
                    loadUserList();
                }
            }
        });
    }

    // 사용자 비밀번호 변경 모달 팝업
    window.promptChangeUserPassword = function(username) {
        if (changeUserPasswordForm) changeUserPasswordForm.reset();
        document.getElementById('changeUserPasswordUsername').value = username;
        document.getElementById('changeUserPasswordTargetId').value = username;
        if (changeUserPasswordModal) changeUserPasswordModal.classList.add('show');
    };

    // 사용자 비밀번호 변경 처리
    if (changeUserPasswordForm) {
        changeUserPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('changeUserPasswordUsername').value;
            const newPw = document.getElementById('newUserChangePassword').value;
            const newPwConfirm = document.getElementById('newUserChangePasswordConfirm').value;

            if (newPw !== newPwConfirm) {
                alert('비밀번호가 서로 일치하지 않습니다.');
                return;
            }

            // 사번 + ":" + 새 비밀번호 조합 후 SHA-256 해싱
            const encoder = new TextEncoder();
            const data = encoder.encode(username + ":" + newPw);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            showLoading();
            let useLocalFallback = false;
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    useLocalFallback = true;
                } else {
                    // 구글 시트 연동 모드
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'changeUserPassword',
                            username,
                            newPasswordHash: hashHex
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            alert('사용자 비밀번호가 성공적으로 변경되었습니다!');
                            if (changeUserPasswordModal) changeUserPasswordModal.classList.remove('show');
                            loadUserList();
                        } else {
                            console.warn('비밀번호 변경 API 실패, 로컬 스토리지에 기록합니다:', result.message);
                            useLocalFallback = true;
                        }
                    } else {
                        useLocalFallback = true;
                    }
                }
            } catch (err) {
                console.error('비밀번호 변경 중 오류, 로컬 스토리지에 기록합니다:', err);
                useLocalFallback = true;
            } finally {
                hideLoading();
            }

            if (useLocalFallback) {
                const localUsers = JSON.parse(localStorage.getItem('localUsersDB') || '[]');
                const userIndex = localUsers.findIndex(u => u.username === username);
                if (userIndex !== -1) {
                    localUsers[userIndex].passwordHash = hashHex;
                    localStorage.setItem('localUsersDB', JSON.stringify(localUsers));
                    alert('사용자 비밀번호가 로컬 저장소에 변경되었습니다! (배포되지 않은 API 모드)');
                    if (changeUserPasswordModal) changeUserPasswordModal.classList.remove('show');
                    loadUserList();
                }
            }
        });
    }

    // 사용자 계정 삭제 처리
    window.deleteUserAccount = async function(username, realName) {
        if (confirm(`정말 사용자 계정 [${realName} (${username})]을(를) 영구 삭제하시겠습니까?`)) {
            showLoading();
            let useLocalFallback = false;
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    useLocalFallback = true;
                } else {
                    // 구글 시트 연동 모드
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'deleteUser',
                            username
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            alert(`사용자 계정 [${realName}]이(가) 정상적으로 삭제되었습니다.`);
                            loadUserList();
                        } else {
                            console.warn('사용자 삭제 API 실패, 로컬 스토리지에 반영합니다:', result.message);
                            useLocalFallback = true;
                        }
                    } else {
                        useLocalFallback = true;
                    }
                }
            } catch (err) {
                console.error('사용자 삭제 오류, 로컬 스토리지에 반영합니다:', err);
                useLocalFallback = true;
            } finally {
                hideLoading();
            }

            if (useLocalFallback) {
                let localUsers = JSON.parse(localStorage.getItem('localUsersDB') || '[]');
                localUsers = localUsers.filter(u => u.username !== username);
                localStorage.setItem('localUsersDB', JSON.stringify(localUsers));
                alert(`사용자 계정 [${realName}]이(가) 로컬 저장소에서 삭제되었습니다. (배포되지 않은 API 모드)`);
                loadUserList();
            }
        }
    };

    // ==========================================
    // 챗봇 가이드 관리 (관리자용) 구현
    // ==========================================
    const chatbotGuideModal = document.getElementById('chatbotGuideModal');
    const chatbotGuideForm = document.getElementById('chatbotGuideForm');
    const btnShowAddGuideModal = document.getElementById('btnShowAddGuideModal');
    const btnCloseChatbotGuideModal = document.getElementById('btnCloseChatbotGuideModal');
    const btnAddDownloadRow = document.getElementById('btnAddDownloadRow');
    const downloadRowsContainer = document.getElementById('downloadRowsContainer');

    // 모달 열기/닫기
    if (btnShowAddGuideModal) {
        btnShowAddGuideModal.addEventListener('click', (e) => {
            e.preventDefault();
            if (chatbotGuideForm) chatbotGuideForm.reset();
            document.getElementById('guideMode').value = 'add';
            document.getElementById('originalGuideKey').value = '';
            document.getElementById('guideKey').disabled = false;
            document.getElementById('chatbotGuideModalTitle').textContent = '새 가이드 등록';
            if (downloadRowsContainer) downloadRowsContainer.innerHTML = '';
            if (chatbotGuideModal) chatbotGuideModal.classList.add('show');
        });
    }

    if (btnCloseChatbotGuideModal) {
        btnCloseChatbotGuideModal.addEventListener('click', () => {
            if (chatbotGuideModal) chatbotGuideModal.classList.remove('show');
        });
    }

    // 다운로드 도구 행 생성 헬퍼
    function createDownloadRow(data = {title: '', text: '', file: '', guide: ''}) {
        const rows = downloadRowsContainer.querySelectorAll('.download-row');
        if (rows.length >= 3) {
            alert('다운로드 도구는 최대 3개까지만 등록할 수 있습니다.');
            return;
        }

        const div = document.createElement('div');
        div.className = 'download-row';
        div.style.cssText = 'border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; position: relative; background-color: #f8fafc; margin-bottom: 8px;';
        
        div.innerHTML = `
            <button type="button" class="btn-remove-row" style="position: absolute; right: 10px; top: 10px; background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem;"><i class="fa-solid fa-trash-can"></i></button>
            <div class="form-group" style="margin-bottom: 8px; width: calc(100% - 30px);">
                <span class="sub-label" style="font-weight:600;">도구 제목</span>
                <input type="text" class="dl-title" value="${data.title || ''}" placeholder="예: 프린터 스풀러 재시작" required style="width:100%;">
            </div>
            <div class="input-row" style="margin-bottom: 8px; gap: 8px;">
                <div class="input-col" style="flex:1;">
                    <span class="sub-label" style="font-weight:600;">다운로드 링크/버튼 텍스트</span>
                    <input type="text" class="dl-text" value="${data.text || ''}" placeholder="예: 🛠️ 프린터 스풀러 재시작 배치파일 다운로드" required style="width:100%;">
                </div>
                <div class="input-col" style="flex:1;">
                    <span class="sub-label" style="font-weight:600;">파일 경로/URL</span>
                    <input type="text" class="dl-file" value="${data.file || ''}" placeholder="예: downloads/restart_spooler.bat" required style="width:100%;">
                </div>
            </div>
            <div class="form-group" style="margin: 0;">
                <span class="sub-label" style="font-weight:600;">주의사항 / 가이드 설명</span>
                <input type="text" class="dl-guide" value="${data.guide || ''}" placeholder="예: 마우스 우클릭 후 관리자 권한으로 실행해야 합니다." required style="width:100%;">
            </div>
        `;

        // 삭제 버튼 바인딩
        div.querySelector('.btn-remove-row').addEventListener('click', () => {
            div.remove();
        });

        downloadRowsContainer.appendChild(div);
    }

    if (btnAddDownloadRow) {
        btnAddDownloadRow.addEventListener('click', () => {
            createDownloadRow();
        });
    }

    // 챗봇 가이드 목록 로드 및 렌더링
    window.loadChatbotGuides = function() {
        const tbody = document.querySelector('#chatbotGuideTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(chatbotGuides) || chatbotGuides.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">등록된 가이드가 없습니다.</td></tr>`;
            return;
        }

        chatbotGuides.forEach((guide, index) => {
            if (!guide || !guide.key) return;
            const tr = document.createElement('tr');
            
            const stepsCount = Array.isArray(guide.steps) ? guide.steps.length : 0;
            const toolsCount = Array.isArray(guide.downloads) ? guide.downloads.length : 0;
            const dateStr = guide.date ? new Date(guide.date).toLocaleDateString('ko-KR', {year: 'numeric', month: '2-digit', day: '2-digit'}) : '-';

            const editBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: #4f46e5; color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="openEditGuideModal('${guide.key}')"><i class="fa-solid fa-pen-to-square"></i> 수정</button>`;
            const deleteBtnHtml = `<button type="button" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.8rem; background-color: #ef4444; color:white; border:none; border-radius: 4px; cursor:pointer; white-space:nowrap; font-weight:500;" onclick="deleteChatbotGuide('${guide.key}')"><i class="fa-solid fa-trash"></i> 삭제</button>`;

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><code>${guide.key}</code></td>
                <td><strong>${guide.title || '-'}</strong></td>
                <td>${stepsCount}단계</td>
                <td>${toolsCount}개</td>
                <td>${dateStr}</td>
                <td>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:nowrap;">
                        ${editBtnHtml}
                        ${deleteBtnHtml}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // 가이드 수정 모달 팝업
    window.openEditGuideModal = function(key) {
        const guide = chatbotGuides.find(g => g.key === key);
        if (!guide) {
            alert('해당 가이드를 찾을 수 없습니다.');
            return;
        }

        if (chatbotGuideForm) chatbotGuideForm.reset();
        
        document.getElementById('guideMode').value = 'edit';
        document.getElementById('originalGuideKey').value = key;
        
        const keyInput = document.getElementById('guideKey');
        keyInput.value = key;
        keyInput.disabled = true;

        document.getElementById('guideTitle').value = guide.title || '';
        document.getElementById('guideSteps').value = Array.isArray(guide.steps) ? guide.steps.join('\n') : '';
        document.getElementById('guideTip').value = guide.tip || '';

        document.getElementById('chatbotGuideModalTitle').textContent = '가이드 수정';

        if (downloadRowsContainer) {
            downloadRowsContainer.innerHTML = '';
            if (Array.isArray(guide.downloads)) {
                guide.downloads.forEach(dl => {
                    createDownloadRow(dl);
                });
            }
        }

        if (chatbotGuideModal) chatbotGuideModal.classList.add('show');
    };

    // 가이드 삭제 처리
    window.deleteChatbotGuide = async function(key) {
        if (confirm(`정말 [${key}] 가이드를 삭제하시겠습니까?`)) {
            showLoading();
            let success = false;
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    // 로컬 테스트 모드
                    chatbotGuides = chatbotGuides.filter(g => g.key !== key);
                    localStorage.setItem('localChatbotGuidesDB', JSON.stringify(chatbotGuides));
                    success = true;
                } else {
                    // 구글 시트 연동
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'deleteChatbotGuide',
                            key: key
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            success = true;
                        } else {
                            alert('가이드 삭제 실패: ' + result.message);
                        }
                    }
                }
            } catch (err) {
                console.error('가이드 삭제 중 오류:', err);
                alert('가이드 삭제 중 네트워크 오류가 발생했습니다.');
            } finally {
                hideLoading();
            }

            if (success) {
                alert('가이드가 성공적으로 삭제되었습니다.');
                // 서버 연동 시에는 변경사항 적용을 위해 loadData() 호출
                if (GOOGLE_SCRIPT_URL) {
                    await loadData();
                } else {
                    loadChatbotGuides();
                    renderQuickReplies();
                }
            }
        }
    };

    // 가이드 폼 제출 처리 (등록/수정)
    if (chatbotGuideForm) {
        chatbotGuideForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const mode = document.getElementById('guideMode').value;
            const originalKey = document.getElementById('originalGuideKey').value;
            const key = document.getElementById('guideKey').value.trim().toLowerCase();
            const title = document.getElementById('guideTitle').value.trim();
            const stepsText = document.getElementById('guideSteps').value.trim();
            const tip = document.getElementById('guideTip').value.trim();

            if (!/^[a-z0-9_]+$/.test(key)) {
                alert('식별 키는 영문 소문자, 숫자, 언더바(_)만 사용할 수 있습니다.');
                return;
            }

            // 해결 단계 줄바꿈 분리
            const steps = stepsText.split('\n').map(s => s.trim()).filter(s => s.length > 0);

            // 다운로드 도구 정보 추출
            const downloads = [];
            const dlRows = downloadRowsContainer.querySelectorAll('.download-row');
            dlRows.forEach(row => {
                const dlTitle = row.querySelector('.dl-title').value.trim();
                const dlText = row.querySelector('.dl-text').value.trim();
                const dlFile = row.querySelector('.dl-file').value.trim();
                const dlGuide = row.querySelector('.dl-guide').value.trim();
                
                if (dlTitle && dlText && dlFile) {
                    downloads.push({
                        title: dlTitle,
                        text: dlText,
                        file: dlFile,
                        guide: dlGuide
                    });
                }
            });

            // 중복 키 체크 (추가 모드일 때 또는 수정 모드에서 키가 바뀔 때)
            if (mode === 'add' && chatbotGuides.some(g => g.key === key)) {
                alert('이미 등록된 식별 키입니다. 다른 키를 입력해주세요.');
                return;
            }

            showLoading();
            let success = false;
            try {
                if (!GOOGLE_SCRIPT_URL) {
                    // 로컬 테스트 모드
                    if (mode === 'add') {
                        const maxId = chatbotGuides.reduce((max, g) => g.id > max ? g.id : max, 0);
                        chatbotGuides.push({
                            id: maxId + 1,
                            key,
                            title,
                            steps,
                            tip,
                            downloads,
                            date: new Date().toISOString()
                        });
                    } else {
                        const targetIndex = chatbotGuides.findIndex(g => g.key === originalKey);
                        if (targetIndex !== -1) {
                            chatbotGuides[targetIndex].title = title;
                            chatbotGuides[targetIndex].steps = steps;
                            chatbotGuides[targetIndex].tip = tip;
                            chatbotGuides[targetIndex].downloads = downloads;
                            chatbotGuides[targetIndex].date = new Date().toISOString();
                        }
                    }
                    localStorage.setItem('localChatbotGuidesDB', JSON.stringify(chatbotGuides));
                    success = true;
                } else {
                    // 구글 시트 연동 모드
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            action: 'saveChatbotGuide',
                            key,
                            title,
                            steps,
                            tip,
                            downloads
                        })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            success = true;
                        } else {
                            alert('가이드 저장 실패: ' + result.message);
                        }
                    }
                }
            } catch (err) {
                console.error('가이드 저장 중 오류:', err);
                alert('가이드 저장 중 네트워크 오류가 발생했습니다.');
            } finally {
                hideLoading();
            }

            if (success) {
                alert(mode === 'add' ? '새 가이드가 정상적으로 등록되었습니다.' : '가이드가 성공적으로 수정되었습니다.');
                if (chatbotGuideModal) chatbotGuideModal.classList.remove('show');
                
                // 데이터 새로고침 및 목록 갱신
                if (GOOGLE_SCRIPT_URL) {
                    await loadData();
                } else {
                    loadChatbotGuides();
                    renderQuickReplies();
                }
            }
        });
    }
});
