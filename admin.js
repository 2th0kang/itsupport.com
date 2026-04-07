document.addEventListener('DOMContentLoaded', () => {
    // 탭 메뉴 동작
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');

            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'page-report') {
                updateReport();
            }
            
            // 현재 머물러 있는 탭 ID를 스토리지에 저장
            localStorage.setItem('adminActiveTab', targetId);
        });
    });

    // 초기 진입 시: 로컬 스토리지에 저장된 마지막 탭 위치로 자동 이동
    const savedAdminTab = localStorage.getItem('adminActiveTab') || 'page-dashboard';
    const adminTabEle = document.querySelector(`.nav-links a[data-target="${savedAdminTab}"]`);
    if (adminTabEle) adminTabEle.click();

    const dateEles = document.querySelectorAll('#currentDate');
    const today = new Date().toISOString().split('T')[0];
    dateEles.forEach(el => el.textContent = today);

    // 향후 조치 계획 저장 로직
    const noteBox = document.getElementById('reportNoteBox');
    const savedNote = localStorage.getItem('itReportNote');
    if (savedNote) noteBox.innerHTML = savedNote;
    noteBox.addEventListener('input', () => {
        localStorage.setItem('itReportNote', noteBox.innerHTML);
    });

    let requests = JSON.parse(localStorage.getItem('itRequests')) || [];
    const requestTableBody = document.querySelector('#requestTable tbody');
    
    const elTotal = document.getElementById('kpiTotal');
    const elInProgress = document.getElementById('kpiInProgress');
    const elCompleted = document.getElementById('kpiCompleted');
    const elRejected = document.getElementById('kpiRejected');

    // 초기화 버튼
    document.getElementById('btnClearData').addEventListener('click', () => {
        if(confirm('모든 접수 내역을 삭제하시겠습니까?')) {
            requests = [];
            saveData();
            renderTable();
            alert('초기화 되었습니다.');
        }
    });

    function saveData() {
        localStorage.setItem('itRequests', JSON.stringify(requests));
        updateDashboardKPI();
    }

    let currentPage = 1;
    const itemsPerPage = 10;
    let currentFilter = 'all';

    window.filterTable = function(filter) {
        currentFilter = filter;
        currentPage = 1; // 필터 변경 시 첫 페이지로 리셋
        renderTable();
        
        // 필터 버튼(카드) 활성화 스타일 적용
        const cards = document.querySelectorAll('.kpi-card');
        const activeCardMap = { 'all': 0, 'in-progress': 1, 'completed': 2, 'rejected': 3 };
        
        cards.forEach((card, index) => {
            if (index === activeCardMap[filter]) {
                card.style.border = '2px solid var(--primary)';
                card.style.transform = 'translateY(-3px)';
                card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
            } else {
                card.style.border = '2px solid transparent';
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; // 기본 그림자
            }
        });
    };

    window.changePage = function(page) {
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
    window.renderTable = function() {
        requests = JSON.parse(localStorage.getItem('itRequests')) || [];
        requestTableBody.innerHTML = '';
        
        let filteredRequests = [...requests].reverse();
        if (currentFilter === 'in-progress') {
            filteredRequests = filteredRequests.filter(r => ['접수', '처리중', '보류'].includes(r.status));
        } else if (currentFilter === 'completed') {
            filteredRequests = filteredRequests.filter(r => r.status === '완료');
        } else if (currentFilter === 'rejected') {
            filteredRequests = filteredRequests.filter(r => r.status === '반려');
        }

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
            
            const statusClass = `status-${req.status}`;
            
            tr.innerHTML = `
                <td>${req.id}</td>
                <td>${req.name}</td>
                <td>${req.team}</td>
                <td><strong>${req.category}</strong></td>
                <td>
                    <select class="status-select ${statusClass}" onchange="changeStatus(${req.id}, this)">
                        <option value="접수" ${req.status === '접수' ? 'selected' : ''}>🔴 접수</option>
                        <option value="처리중" ${req.status === '처리중' ? 'selected' : ''}>🟡 처리중</option>
                        <option value="보류" ${req.status === '보류' ? 'selected' : ''}>⚪ 보류</option>
                        <option value="완료" ${req.status === '완료' ? 'selected' : ''}>🟢 완료</option>
                        <option value="반려" ${req.status === '반려' ? 'selected' : ''}>❌ 반려</option>
                    </select>
                </td>
                <td>
                    <button class="btn-del" onclick="deleteReq(${req.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            requestTableBody.appendChild(tr);
        });
        
        updateDashboardKPI();
        updateReport(); // 데이터 렌더링시 리포트도 같이 갱신
        renderPagination(totalPages);
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

        overlay.querySelector('#progCancel').onclick = () => {
            selectEle.value = req.status; // Revert
            document.body.removeChild(overlay);
        };

        overlay.querySelector('#progSave').onclick = () => {
            let reason = sel.value;
            if (reason === '기타') reason = inp.value || '기타';
            req.completeReason = reason;
            
            req.status = '완료';
            saveData();
            selectEle.className = `status-select status-완료`;
            updateReport();
            document.body.removeChild(overlay);
        };
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

    window.changeStatus = function(id, selectEle) {
        const newStatus = selectEle.value;
        const req = requests.find(r => r.id === id);
        if(req) {
            if (newStatus === '반려') {
                const reason = prompt('반려 사유를 입력해주세요:');
                if (reason === null) {
                    selectEle.value = req.status;
                    return;
                }
                req.rejectReason = reason || '사유 미입력';
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
                    return; // 모달에서 저장 완료 시까지 중단
                } else {
                    const reason = prompt(`${req.category} 처리 내역(사유)을 입력하세요:`);
                    if (reason === null) {
                        selectEle.value = req.status;
                        return;
                    }
                    req.completeReason = reason || '사유 미입력';
                }
            } else {
                req.completeReason = '';
            }

            req.status = newStatus;
            saveData();
            selectEle.className = `status-select status-${newStatus}`;
            
            // 상태변경 시 리포트 탭 즉시 반영을 위함
            updateReport();
        }
    }

    window.deleteReq = function(id) {
        if(confirm('해당 문의 내역을 삭제할까요?')) {
            requests = requests.filter(r => r.id !== id);
            saveData();
            renderTable();
        }
    }

    function updateDashboardKPI() {
        const total = requests.length;
        const rejected = requests.filter(r => r.status === '반려').length;
        const completed = requests.filter(r => r.status === '완료').length;
        const inProgress = requests.filter(r => ['접수', '처리중', '보류'].includes(r.status)).length;

        elTotal.textContent = total + "건";
        elInProgress.textContent = inProgress + "건";
        elCompleted.textContent = completed + "건";
        elRejected.textContent = rejected + "건";
    }

    function updateReport() {
        const total = requests.length;
        const completed = requests.filter(r => r.status === '완료').length;
        const inProgress = requests.filter(r => ['접수', '처리중', '보류'].includes(r.status)).length;
        const rejected = requests.filter(r => r.status === '반려').length;
        
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
        catsUl.innerHTML = `
            <li style="cursor:pointer;" onclick="showCategoryRank('고장/오류')" title="클릭하여 상세 처리 내역 확인"><strong>고장/오류:</strong> <span class="bg-blue-light tag" style="float:right;">${catCounts['고장/오류'] || 0}건</span></li>
            <li style="cursor:pointer;" onclick="showCategoryRank('프로그램 설치')" title="클릭하여 상세 처리 내역 확인"><strong>프로그램 설치:</strong> <span class="bg-blue-light tag" style="float:right;">${catCounts['프로그램 설치'] || 0}건</span></li>
            <li style="cursor:pointer;" onclick="showCategoryRank('소모품 필요')" title="클릭하여 상세 처리 내역 확인"><strong>소모품 필요:</strong> <span class="bg-blue-light tag" style="float:right;">${catCounts['소모품 필요'] || 0}건</span></li>
        `;

        const teamCounts = requests.reduce((acc, curr) => {
            acc[curr.team] = (acc[curr.team] || 0) + 1;
            return acc;
        }, {});

        const sortedTeams = Object.entries(teamCounts)
                                .sort((a,b) => b[1] - a[1])
                                .slice(0, 3);
        
        const teamsOl = document.getElementById('repTeams');
        if (sortedTeams.length > 0) {
            teamsOl.innerHTML = sortedTeams.map(([team, count]) => `<li style="cursor: pointer;" onclick="showTeamRank('${team}')" title="클릭하여 부서 내 요청자 순위 및 횟수 확인">${team}: <strong>${count}건</strong></li>`).join('');
        } else {
            teamsOl.innerHTML = '<li>데이터가 없습니다.</li>';
        }
    }

    // 모달 관련 로직
    const modalOverlay = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    const btnCloseModal = document.getElementById('btnCloseModal');

    window.showCategoryRank = function(catName) {
        requests = JSON.parse(localStorage.getItem('itRequests')) || [];
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

    window.showTeamRank = function(teamName) {
        requests = JSON.parse(localStorage.getItem('itRequests')) || [];
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

    window.openDetailModal = function(id) {
        document.querySelector('#detailModal .modal-header h2').textContent = `문의 상세 정보`;
        requests = JSON.parse(localStorage.getItem('itRequests')) || [];
        const req = requests.find(r => r.id === id);
        if(!req) return;

        let progress = '0%';
        if (req.status === '접수') progress = '0%';
        else if (req.status === '처리중') progress = '50%';
        else if (req.status === '보류') progress = '25%';
        else if (req.status === '완료') progress = '100%';
        else if (req.status === '반려') progress = '100%'; 

        const dateStr = new Date(req.date).toLocaleDateString() + " " + new Date(req.date).toLocaleTimeString();

        let rejectHtml = '';
        if (req.status === '반려' && req.rejectReason) {
            rejectHtml = `<div class="detail-row"><span class="detail-label" style="color: var(--danger);">반려 사유</span> <span class="detail-value" style="color: var(--danger); font-weight: 600;">${req.rejectReason}</span></div>`;
        } else if (req.status === '완료' && req.completeReason) {
            rejectHtml = `<div class="detail-row"><span class="detail-label" style="color: var(--secondary);">처리 내역</span> <span class="detail-value" style="color: var(--secondary); font-weight: 600;">${req.completeReason}</span></div>`;
        }

        modalBody.innerHTML = `
            <div class="detail-row"><span class="detail-label">No</span> <span class="detail-value">${req.id}</span></div>
            <div class="detail-row"><span class="detail-label">요청자</span> <span class="detail-value">${req.name}</span></div>
            <div class="detail-row"><span class="detail-label">소속 팀</span> <span class="detail-value">${req.team}</span></div>
            <div class="detail-row"><span class="detail-label">카테고리</span> <span class="detail-value">${req.category}</span></div>
            <div class="detail-row"><span class="detail-label">상세 내용</span> <span class="detail-value">${req.desc}</span></div>
            <div class="detail-row"><span class="detail-label">접수 일자</span> <span class="detail-value">${dateStr}</span></div>
            <div class="detail-row"><span class="detail-label">현재 상태</span> <span class="detail-value"><span class="tag status-${req.status}">${req.status}</span></span></div>
            ${rejectHtml}
            <div class="detail-row">
                <span class="detail-label">진행률</span> 
                <span class="detail-value">
                    ${progress}
                    <div class="detail-progress"><div class="detail-progress-bar" style="width: ${progress}; background-color: ${req.status === '완료' ? 'var(--secondary)' : req.status === '반려' ? 'var(--danger)' : 'var(--primary)'}"></div></div>
                </span>
            </div>
        `;
        modalOverlay.classList.add('show');
    };

    btnCloseModal.addEventListener('click', () => {
        modalOverlay.classList.remove('show');
    });

    modalOverlay.addEventListener('click', (e) => {
        if(e.target === modalOverlay) {
            modalOverlay.classList.remove('show');
        }
    });

    filterTable('all');

    // 혹시라도 유저창에서 문의가 접수되었을 때 실시간 표시
    window.addEventListener('storage', (e) => {
        if (e.key === 'itRequests') {
            renderTable();
        }
    });
});
