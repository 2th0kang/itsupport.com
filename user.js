document.addEventListener('DOMContentLoaded', () => {
    // 탭 메뉴 동작
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // 탭 활성화 변경
            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');

            // 페이지 변경
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // 현재 머물러 있는 탭 ID를 스토리지에 저장
            localStorage.setItem('userActiveTab', targetId);
        });
    });

    // 초기 진입 시: 로컬 스토리지에 저장된 마지막 탭 위치로 자동 이동
    const savedUserTab = localStorage.getItem('userActiveTab') || 'page-request';
    const userTabEle = document.querySelector(`.nav-links a[data-target="${savedUserTab}"]`);
    if (userTabEle) userTabEle.click();

    /* --- 데이터 관리 로직 --- */
    let requests = JSON.parse(localStorage.getItem('itRequests')) || [];

    const requestForm = document.getElementById('requestForm');
    const requestTableBody = document.querySelector('#requestTable tbody');
    
    // KPI 엘리먼트
    const elTotal = document.getElementById('kpiTotal');
    const elInProgress = document.getElementById('kpiInProgress');
    const elCompleted = document.getElementById('kpiCompleted');
    const elRejected = document.getElementById('kpiRejected');

    // 폼 제출 이벤트
    requestForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 데이터 다시 불러오기 (다른 창에서 추가되었을 수도 있으므로)
        requests = JSON.parse(localStorage.getItem('itRequests')) || [];
        
        const name = document.getElementById('reqName').value;
        const team = document.getElementById('reqTeam').value;
        const category = document.getElementById('reqCategory').value;
        const desc = document.getElementById('reqDesc').value;

        const newRequest = {
            id: generateId(),
            name,
            team,
            category,
            desc,
            status: '접수',
            date: new Date().toISOString()
        };

        requests.push(newRequest);
        saveData();
        renderTable();
        
        alert('문의가 접수되었습니다.');
        requestForm.reset();
        
        // 접수 후 대시보드로 이동
        navLinks[1].click();
    });

    // ID 생성 (1부터 순차 생성)
    function generateId() {
        if (requests.length === 0) return 1;
        const maxId = Math.max(...requests.map(r => r.id));
        return maxId + 1;
    }

    // 로컬 스토리지 저장
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
        
        // 필터 버튼 활성화 디자인
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
        // 데이터 실시간 동기화를 위해 스토리지 다시 읽기
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
            tr.onclick = () => openDetailModal(req.id);
            
            // 일반 사용자 화면에서는 상태를 단순 뱃지로만 표시 (수정 불가)
            const statusBadge = `
                <span class="tag status-${req.status}" style="font-size: 0.85rem; padding: 6px 10px; border: 1px solid var(--border-color);">
                    ${req.status === '접수' ? '🔴 접수' : ''}
                    ${req.status === '처리중' ? '🟡 처리중' : ''}
                    ${req.status === '보류' ? '⚪ 보류' : ''}
                    ${req.status === '완료' ? '🟢 완료' : ''}
                    ${req.status === '반려' ? '❌ 반려' : ''}
                </span>
            `;
            
            tr.innerHTML = `
                <td>${req.id}</td>
                <td>${req.name}</td>
                <td>${req.team}</td>
                <td><strong>${req.category}</strong></td>
                <td>${statusBadge}</td>
            `;
            requestTableBody.appendChild(tr);
        });
        
        updateDashboardKPI();
        renderPagination(totalPages);
    };

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

    // 모달 관련 로직
    const modalOverlay = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    const btnCloseModal = document.getElementById('btnCloseModal');

    window.openDetailModal = function(id) {
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

    // 페이지 접속 시 데이터 로드 및 렌더링 (전체 필터 기본 적용)
    filterTable('all');

    // 혹시라도 관리자가 데이터를 변경시(localStorage가 업데이트 됨) 실시간 반영을 위한 리스너(Storage Event)
    window.addEventListener('storage', (e) => {
        if (e.key === 'itRequests') {
            renderTable();
        }
    });
});
