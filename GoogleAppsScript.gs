/**
 * ========================================================
 * 이 코드는 구글 스프레드시트를 백엔드 서버(API)로 사용하기 위한 구글 앱스 스크립트 코드입니다.
 * ========================================================
 */

// 구글 스프레드시트 주소를 아래 따옴표 안에 붙여넣으세요.
var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1HWDa7XVGFh1-LGRKySZOR8Ci5gnK6nkgdIl4ELsjSSY/edit?gid=0#gid=0';

// 대시보드 웹페이지 주소를 아래 따옴표 안에 붙여넣으세요.
var DASHBOARD_URL = 'https://2th0kang.github.io/itsupport.com/';



// 유틸리티: 시트 이름으로 시트 가져오기 (없으면 생성)
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// 안전장치: 기존 단일 시트 구조를 다중 시트 구조로 안전 전환, 컬럼 확장 및 초기화
function getOrInitializeSheets(ss) {
  // 1. 문의접수 내역 시트 확보
  var requestSheet = ss.getSheetByName('문의접수 내역');
  if (!requestSheet) {
    var sheets = ss.getSheets();
    if (sheets.length > 0) {
      requestSheet = sheets[0];
      requestSheet.setName('문의접수 내역');
    } else {
      requestSheet = ss.insertSheet('문의접수 내역');
    }
  }
  
  // 2. 실적 보고서 및 지급설치내역 시트
  var reportSheet = getOrCreateSheet(ss, '실적 보고서');
  var provisionSheet = getOrCreateSheet(ss, '지급설치내역');
  
  // 3. 관리자 계정 및 사용자 계정 시트 확보 및 초기화 (로그인 시스템용)
  var adminSheet = ss.getSheetByName('관리자 계정');
  if (!adminSheet) {
    adminSheet = ss.insertSheet('관리자 계정');
    adminSheet.appendRow(['id', 'name', 'username', 'password', 'email', 'date']);
  } else {
    // 기존 시트에 email 컬럼이 없으면 헤더에 자동 추가 (자가 복구)
    var adminData = adminSheet.getDataRange().getValues();
    var adminHeaders = adminData[0] || [];
    if (adminHeaders.indexOf('email') === -1) {
      var lastCol = adminSheet.getLastColumn();
      adminSheet.getRange(1, lastCol + 1).setValue('email');
      // 기존 관리자들의 기본 메일 채워주기
      if (adminData.length > 1) {
        var userColIdx = adminHeaders.indexOf('username');
        for (var idx = 2; idx <= adminData.length; idx++) {
          var userVal = adminSheet.getRange(idx, userColIdx + 1).getValue().toString().trim();
          adminSheet.getRange(idx, lastCol + 1).setValue(userVal ? (userVal + "@swei.co.kr") : "admin@swei.co.kr");
        }
      }
    }
  }
  
  // 데이터 행 확인 후 계정이 아예 없으면 마스터 계정 강제 추가
  var adminData = adminSheet.getDataRange().getValues();
  var adminHeaders = adminData[0];
  
  if (adminData.length <= 1) {
    var masterRow = [];
    for (var m = 0; m < adminHeaders.length; m++) {
      var hName = adminHeaders[m].toString().trim();
      if (hName === 'id') masterRow.push(1);
      else if (hName === 'name') masterRow.push('마스터 관리자');
      else if (hName === 'username') masterRow.push('admin');
      else if (hName === 'password') masterRow.push('f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c');
      else if (hName === 'email') masterRow.push('admin@swei.co.kr');
      else if (hName === 'date') masterRow.push(new Date());
      else masterRow.push('');
    }
    adminSheet.appendRow(masterRow);
  } else {
    // [자가 복구] ID가 1인 마스터 계정이 여러 개 존재하는 경우 복구 로직
    var idColIdx = adminHeaders.indexOf('id');
    var usernameColIdx = adminHeaders.indexOf('username');
    if (idColIdx !== -1 && usernameColIdx !== -1) {
      var masterCount = 0;
      var maxId = 0;
      var adminRowIndexesToUpdate = [];
      
      for (var k = 1; k < adminData.length; k++) {
        var currentId = Number(adminData[k][idColIdx]);
        if (!isNaN(currentId)) {
          if (currentId > maxId) maxId = currentId;
          if (currentId === 1) {
            masterCount++;
            // username이 'admin'인 중복 마스터 후보 수집
            if (adminData[k][usernameColIdx].toString().trim() === 'admin') {
              adminRowIndexesToUpdate.push(k + 1); // 1-indexed row number
            }
          }
        }
      }
      
      // ID 1이 중복이고, username이 'admin'인 복구 후보가 있는 경우 ID 재조정
      if (masterCount > 1 && adminRowIndexesToUpdate.length > 0) {
        for (var idx = 0; idx < adminRowIndexesToUpdate.length; idx++) {
          maxId++;
          adminSheet.getRange(adminRowIndexesToUpdate[idx], idColIdx + 1).setValue(maxId);
        }
        SpreadsheetApp.flush();
      }
    }
  }
  
  var userDbSheet = ss.getSheetByName('사용자 계정');
  if (!userDbSheet) {
    userDbSheet = ss.insertSheet('사용자 계정');
    userDbSheet.appendRow(['사원 ID', '이름', '소속팀', '이메일', '비밀번호']);
  }
  
  // 샘플 계정 testuser가 없으면 추가
  var userData = userDbSheet.getDataRange().getValues();
  var hasTestuser = false;
  if (userData.length > 1) {
    var userHeaders = userData[0];
    var userIdColIdx = -1;
    for (var u = 0; u < userHeaders.length; u++) {
      var uh = userHeaders[u].toString().trim().toLowerCase();
      if (uh === '사원 id' || uh === '사원id' || uh === '아이디' || uh === 'id' || uh === 'username' || uh === '사번' || uh === '사원번호') {
        userIdColIdx = u;
        break;
      }
    }
    if (userIdColIdx !== -1) {
      for (var k = 1; k < userData.length; k++) {
        if (userData[k][userIdColIdx].toString().trim() === 'testuser') {
          hasTestuser = true;
          break;
        }
      }
    }
  }
  if (!hasTestuser) {
    userDbSheet.appendRow(['testuser', '테스트유저', '전산팀', 'testuser@swei.co.kr', '1234']);
  }

  // 6. 챗봇 가이드 시트 확보 및 초기화 (동적 관리 데이터베이스 구축)
  var chatbotSheet = ss.getSheetByName('챗봇 가이드');
  if (!chatbotSheet) {
    chatbotSheet = ss.insertSheet('챗봇 가이드');
    chatbotSheet.appendRow(['id', 'key', 'title', 'steps', 'tip', 'downloads', 'date']);
    
    // 초기 4개 샘플 데이터 구성 (기존 monitor, printer, slow, share 도움말)
    var initialGuides = [
      [
        1, 
        'monitor', 
        '🖥️ 모니터 화면이 안 나옴 해결법', 
        '전원 케이블 확인: 모니터 뒷면과 콘센트에 전원선이 단단히 꽂혀 있는지 확인하고, 모니터 전원 버튼을 눌러보세요. (대기 전원 램프 불빛 확인)\n케이블 재연결: PC 본체와 모니터를 연결하는 영상 케이블(HDMI, DP 등)을 뺐다가 먼지를 턴 후 다시 끝까지 밀어 넣어 연결하세요. 듀얼 모니터인 경우 케이블 포트를 서로 바꾸어 꽂아 봅니다.\n입력 소스 설정 확인: 모니터 하단/뒷면의 메뉴 버튼을 눌러 입력 소스(Input Source)가 올바른 포트(HDMI, DP 등)로 설정되어 있는지 확인하세요.\n본체 전원 재부팅: 본체 전원 버튼을 5초 이상 길게 눌러 강제 종료한 후, 1분 뒤에 다시 켜서 부팅 화면이 올라오는지 확인합니다.',
        '모니터 자체 화면에 \'케이블 연결 상태 확인\' 혹은 \'신호 없음(No Signal)\' 문구가 뜬다면 케이블 접촉 불량이나 본체 그래픽 카드 이상일 가능성이 높습니다.',
        '[]',
        new Date()
      ],
      [
        2,
        'printer',
        '🖨️ 프린터/인쇄 오류 해결법',
        '기본 프린터 확인: [제어판] -> [장치 및 프린터]에서 사용하고자 하는 사내 복합기(예: 3층 신도리코)가 \'기본 프린터\'로 체크되어 있는지 확인하세요.\n인쇄 대기열 삭제: 인쇄가 안 되어 여러 번 누른 경우 대기열에 문서가 꼬여서 안 나올 수 있습니다. 프린터 아이콘을 더블 클릭한 후 [모든 문서 취소]를 누르고 재인쇄해 보세요.\n프린터 스풀러(Spooler) 재시작: 아래 제공된 자동 해결 도구(배치파일)를 사용하여 서비스를 재시작할 수 있습니다.',
        '복합기 본체 액정 화면에 \'용지 걸림\'이나 \'토너 부족\' 에러 메시지가 표시 중인지 먼저 체크해 보시기 바랍니다.',
        '[{"title":"프린터 스풀러 재시작","text":"🛠️ 프린터 스풀러 재시작 배치파일 다운로드","file":"downloads/restart_spooler.bat","guide":"다운로드된 파일을 실행하기 전에 반드시 마우스 우클릭 -> 관리자 권한으로 실행을 눌러주셔야 인쇄 서비스가 정상 재시작됩니다."}]',
        new Date()
      ],
      [
        3,
        'slow',
        '⚡ PC 속도 저하 및 프로그램 오류 해결법',
        '불필요한 프로세스 종료: [작업 관리자 (Ctrl+Shift+Esc)]를 열고 CPU 또는 메모리 점유율이 90% 이상인 사용하지 않는 프로그램을 찾아 [작업 끝내기]를 실행하세요.\n디스크 공간 확보: C 드라이브 용량이 부족하면 속도가 극도로 느려집니다. 다운로드 폴더 및 휴지통을 비우고 불필요한 대용량 파일을 D 드라이브로 백업하세요.',
        'PC를 수 주간 끄지 않고 대기 모드로만 사용하면 메모리 누수가 발생하므로, 최소 1주일에 2~3회 이상은 PC 종료 및 다시 시작을 권장합니다.',
        '[]',
        new Date()
      ],
      [
        4,
        'share',
        '📁 공유폴더 접속 오류 해결법',
        '네트워크 경로 확인: 접속하려는 공유폴더 주소(예: \\\\192.168.1.10)의 스펠링과 백슬래시(\\\\) 입력 방향이 올바른지 확인해 주세요.\n윈도우 자격증명 초기화: 사내 메일 패스워드 등을 바꾼 후 이전 세션이 꼬여서 접근이 안 될 수 있습니다. 아래 제공된 자동 초기화 도구(배치파일)를 실행해 연결을 강제 초기화한 후 PC를 재부팅하고 재접속해 보세요.\n윈도우 11 특정 서버 접속 실패(11번 스캔팩스 / 39번 소프트웨어 점검): 윈도우 11의 최신 보안 정책으로 인해 일부 사내 공유폴더 서버에 접근할 수 없을 수 있습니다. 아래 제공된 \'윈도우 11 공유폴더 접속 복구 도구\'를 실행하여 보안 설정을 변경하고 PC를 재부팅해 보세요.',
        '특정 폴더에만 접속 권한 없음 에러가 발생한다면, 폴더 소유자나 전산 부서에 계정 권한이 정상 등록되어 있는지 확인을 거쳐야 합니다.',
        '[{"title":"공유폴더 자격증명 캐시 제거 (공통)","text":"🛠️ 윈도우 자격증명 초기화 배치파일 다운로드","file":"downloads/reset_share_credentials.bat","guide":"다운로드된 파일을 더블 클릭하여 실행하면 꼬여 있던 모든 공유 폴더 가상 연결이 초기화됩니다. 실행 완료 후 반드시 PC를 재부팅한 뒤 재접속하여 사내 로그인 아이디와 패스워드를 입력해 보세요."},{"title":"윈도우 11 전용 접속 오류 복구 (11번 스캔팩스 / 39번 소프트웨어 점검 서버용)","text":"🛠️ 윈도우 11 공유폴더 접속 복구 배치파일 다운로드","file":"downloads/fix_win11_share_error.bat","guide":"다운로드된 파일을 실행하면 윈도우 11에서 11번(스캔팩스) 및 39번(소프트웨어 점검) 서버로의 게스트 로그인 허용 및 보안 서명 요구 해제 설구를 복구합니다. 실행 완료 후 반드시 PC를 재부팅해 주세요."}]',
        new Date()
      ]
    ];
    for (var i = 0; i < initialGuides.length; i++) {
      chatbotSheet.appendRow(initialGuides[i]);
    }
  }
  
  return {
    requests: requestSheet,
    report: reportSheet,
    provision: provisionSheet,
    admin: adminSheet,
    userDb: userDbSheet,
    chatbot: chatbotSheet
  };
}

// SHA-256 해싱 함수
function sha256(text) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = '0' + byteString;
    txtHash += byteString;
  }
  return txtHash;
}

// 평문 비밀번호 자동 감지 및 보안 해싱
function checkAndHashPlainPasswords(ss) {
  var adminSheet = ss.getSheetByName('관리자 계정');
  if (adminSheet) {
    var data = adminSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var usernameColIdx = headers.indexOf('username');
      var passwordColIdx = headers.indexOf('password');
      if (usernameColIdx !== -1 && passwordColIdx !== -1) {
        var updated = false;
        for (var i = 1; i < data.length; i++) {
          var username = data[i][usernameColIdx] ? data[i][usernameColIdx].toString().trim() : '';
          var password = data[i][passwordColIdx] ? data[i][passwordColIdx].toString().trim() : '';
          if (password && !/^[0-9a-f]{64}$/i.test(password)) {
            var hash = sha256(username + ":" + password);
            adminSheet.getRange(i + 1, passwordColIdx + 1).setValue(hash);
            updated = true;
          }
        }
        if (updated) {
          SpreadsheetApp.flush();
        }
      }
    }
  }

  var userDbSheet = ss.getSheetByName('사용자 계정');
  if (userDbSheet) {
    var data = userDbSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var usernameColIdx = -1;
      var passwordColIdx = -1;
      
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j].toString().trim().toLowerCase();
        if (h === '사원 id' || h === '사원id' || h === '아이디' || h === 'id' || h === 'username' || h === '사번' || h === '사원번호') {
          usernameColIdx = j;
        } else if (h === '비밀번호' || h === 'password' || h === 'pw' || h === '비번' || h === '패스워드' || h === '암호') {
          passwordColIdx = j;
        }
      }
      
      if (usernameColIdx !== -1 && passwordColIdx !== -1) {
        var updated = false;
        for (var i = 1; i < data.length; i++) {
          var username = data[i][usernameColIdx] ? data[i][usernameColIdx].toString().trim() : '';
          var password = data[i][passwordColIdx] ? data[i][passwordColIdx].toString().trim() : '';
          if (password && !/^[0-9a-f]{64}$/i.test(password)) {
            var hash = sha256(username + ":" + password);
            userDbSheet.getRange(i + 1, passwordColIdx + 1).setValue(hash);
            updated = true;
          }
        }
        if (updated) {
          SpreadsheetApp.flush();
        }
      }
    }
  }
}

// 다중 시트 바인딩 및 사용자 유효성 검사 (3단계 검증)
function validateUser(ss, username, passwordHash) {
  if (!username || !passwordHash) {
    return { isValid: false };
  }
  
  passwordHash = passwordHash.toLowerCase();
  
  // 비밀번호 평문 해싱 동기화
  checkAndHashPlainPasswords(ss);

  // 1단계 & 2단계: 관리자 계정 검증
  var adminSheet = ss.getSheetByName('관리자 계정');
  if (adminSheet) {
    var data = adminSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var usernameColIdx = headers.indexOf('username');
      var passwordColIdx = headers.indexOf('password');
      var nameColIdx = headers.indexOf('name');
      var emailColIdx = headers.indexOf('email');
      
      if (usernameColIdx !== -1 && passwordColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          var dbUser = data[i][usernameColIdx].toString().trim();
          var dbPass = data[i][passwordColIdx].toString().trim().toLowerCase();
          var dbName = nameColIdx !== -1 ? data[i][nameColIdx].toString().trim() : '관리자';
          var dbEmail = emailColIdx !== -1 ? data[i][emailColIdx].toString().trim() : (dbUser + '@swei.co.kr');
          
          if (dbUser === username && dbPass === passwordHash) {
            return {
              isValid: true,
              role: 'admin',
              name: dbName,
              team: '전산팀',
              email: dbEmail
            };
          }
        }
      }
    }
  }

  // 3단계: 일반 사용자 검증
  var userDbSheet = ss.getSheetByName('사용자 계정');
  if (userDbSheet) {
    var data = userDbSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var usernameColIdx = -1;
      var passwordColIdx = -1;
      var nameColIdx = -1;
      var teamColIdx = -1;
      var emailColIdx = -1;
      
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j].toString().trim().toLowerCase();
        if (h === '사원 id' || h === '사원id' || h === '아이디' || h === 'id' || h === 'username' || h === '사번' || h === '사원번호') {
          usernameColIdx = j;
        } else if (h === '비밀번호' || h === 'password' || h === 'pw' || h === '비번' || h === '패스워드' || h === '암호') {
          passwordColIdx = j;
        } else if (h === '이름' || h === 'name' || h === '성명') {
          nameColIdx = j;
        } else if (h === '소속팀' || h === '소속 팀' || h === '부서' || h === 'team' || h === 'dept' || h === '소속') {
          teamColIdx = j;
        } else if (h === '이메일' || h === 'email' || h === '메일') {
          emailColIdx = j;
        }
      }
      
      if (usernameColIdx !== -1 && passwordColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          var dbUser = data[i][usernameColIdx].toString().trim();
          var dbPass = data[i][passwordColIdx].toString().trim().toLowerCase();
          var dbName = nameColIdx !== -1 ? data[i][nameColIdx].toString().trim() : '';
          var dbTeam = teamColIdx !== -1 ? data[i][teamColIdx].toString().trim() : '';
          var dbEmail = emailColIdx !== -1 ? data[i][emailColIdx].toString().trim() : '';
          
          if (dbUser === username && dbPass === passwordHash) {
            return {
              isValid: true,
              role: 'user',
              name: dbName,
              team: dbTeam,
              email: dbEmail || (username + '@swei.co.kr')
            };
          }
        }
      }
    }
  }

  return { isValid: false };
}

// 데이터 조회 (GET 요청 처리) - API 보안 적용
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var username = e.parameter.username;
    var passwordHash = e.parameter.passwordHash;
    
    // 유효 사용자 검증
    var auth = validateUser(ss, username, passwordHash);
    if (!auth.isValid) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unauthorized'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheets = getOrInitializeSheets(ss);
    
    function parseSheetData(sheet) {
      var data = sheet.getDataRange().getValues();
      var items = [];
      if (data.length > 1) {
        var headers = data[0];
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var obj = {};
          for (var j = 0; j < headers.length; j++) {
            var key = headers[j];
            var val = row[j];
            
            if (key === 'images' || key === 'files' || key === 'fileAttachments') {
              try { obj[key] = val ? JSON.parse(val) : []; } catch(err) { obj[key] = []; }
            } else if (key === 'id') {
              obj[key] = Number(val);
            } else {
              obj[key] = val;
            }
          }
          items.push(obj);
        }
      }
      return items;
    }

    function parseChatbotGuides(sheet) {
      var data = sheet.getDataRange().getValues();
      var items = [];
      if (data.length > 1) {
        var headers = data[0];
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var obj = {};
          for (var j = 0; j < headers.length; j++) {
            var key = headers[j];
            var val = row[j];
            if (key === 'steps') {
              obj[key] = val ? val.split('\n') : [];
            } else if (key === 'downloads') {
              try { obj[key] = val ? JSON.parse(val) : []; } catch(err) { obj[key] = []; }
            } else if (key === 'id') {
              obj[key] = Number(val);
            } else {
              obj[key] = val;
            }
          }
          items.push(obj);
        }
      }
      return items;
    }
    
    var result = {
      status: 'success',
      requests: parseSheetData(sheets.requests),
      chatbotGuides: parseChatbotGuides(sheets.chatbot)
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 데이터 저장 및 보안 제어 (POST 요청 처리)
function doPost(e) {
  try {
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var payload = JSON.parse(e.postData.contents);
    var sheets = getOrInitializeSheets(ss);
    var action = payload.action;
    
    // 0. 파일 구글 드라이브 업로드 액션 (사무용 파일 연동)
    if (action === 'uploadFile') {
      var filename = payload.filename;
      var mimeType = payload.mimeType;
      var base64Data = payload.base64;
      
      // 'IT전산문의_첨부파일' 폴더 탐색 및 신규 생성
      var folderName = 'IT전산문의_첨부파일';
      var folders = DriveApp.getFoldersByName(folderName);
      var folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
      
      // Base64 데이터를 디코딩하여 드라이브에 파일 생성
      var decoded = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(decoded, mimeType, filename);
      var file = folder.createFile(blob);
      
      // 링크 권한을 가진 누구나 보기 가능하도록 공유 허용
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        name: filename,
        url: file.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 1. 로그인 검증 처리 액션
    if (action === 'login') {
      var username = payload.username;
      var passwordHash = payload.passwordHash;
      var auth = validateUser(ss, username, passwordHash);
      if (auth.isValid) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          isValid: true,
          role: auth.role,
          name: auth.name,
          team: auth.team,
          email: auth.email
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          isValid: false
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 2. 신규 관리자 추가 액션
    else if (action === 'addAdmin') {
      var adminSheet = ss.getSheetByName('관리자 계정');
      if (!adminSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '관리자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var username = payload.username.toString().trim();
      var name = payload.name.toString().trim();
      var password = payload.password.toString().trim(); // 이미 해싱된 상태
      var email = payload.email ? payload.email.toString().trim() : (username + "@swei.co.kr");
      
      var data = adminSheet.getDataRange().getValues();
      var headers = data[0];
      var usernameColIdx = headers.indexOf('username');
      
      if (usernameColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][usernameColIdx].toString().trim() === username) {
            return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '이미 존재하는 관리자 ID입니다.'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      
      var maxId = 0;
      var idColIdx = headers.indexOf('id');
      if (idColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          var currentId = Number(data[i][idColIdx]);
          if (!isNaN(currentId) && currentId > maxId) {
            maxId = currentId;
          }
        }
      }
      var newId = maxId + 1;
      
      var newRow = [];
      for (var j = 0; j < headers.length; j++) {
        var col = headers[j];
        if (col === 'id') newRow.push(newId);
        else if (col === 'name') newRow.push(name);
        else if (col === 'username') newRow.push(username);
        else if (col === 'password') newRow.push(password);
        else if (col === 'email') newRow.push(email);
        else if (col === 'date') newRow.push(new Date());
        else newRow.push('');
      }
      adminSheet.appendRow(newRow);
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. 관리자 목록 조회 액션
    else if (action === 'getAdmins') {
      var adminSheet = ss.getSheetByName('관리자 계정');
      if (!adminSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '관리자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var data = adminSheet.getDataRange().getValues();
      var admins = [];
      if (data.length > 1) {
        var headers = data[0];
        var idColIdx = headers.indexOf('id');
        var nameColIdx = headers.indexOf('name');
        var usernameColIdx = headers.indexOf('username');
        var emailColIdx = headers.indexOf('email');
        var dateColIdx = headers.indexOf('date');
        
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var adminObj = {
            id: idColIdx !== -1 ? Number(row[idColIdx]) : i,
            name: nameColIdx !== -1 ? row[nameColIdx] : '',
            username: usernameColIdx !== -1 ? row[usernameColIdx] : '',
            email: emailColIdx !== -1 ? row[emailColIdx] : '',
            date: dateColIdx !== -1 ? row[dateColIdx] : ''
          };
          admins.push(adminObj);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success', admins: admins}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. 관리자 삭제 액션
    else if (action === 'deleteAdmin') {
      var adminSheet = ss.getSheetByName('관리자 계정');
      if (!adminSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '관리자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var adminId = Number(payload.adminId);
      
      var data = adminSheet.getDataRange().getValues();
      var headers = data[0];
      var idColIdx = headers.indexOf('id');
      
      if (idColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (Number(data[i][idColIdx]) === adminId) {
            if (adminId === 1) {
              return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '마스터 관리자 계정은 삭제할 수 없습니다.'}))
                .setMimeType(ContentService.MimeType.JSON);
            }
            adminSheet.deleteRow(i + 1);
            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 ID를 가진 관리자를 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 5. 관리자 비밀번호 변경 액션
    else if (action === 'changeAdminPassword') {
      var adminSheet = ss.getSheetByName('관리자 계정');
      if (!adminSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '관리자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var adminId = Number(payload.adminId);
      var newPasswordHash = payload.newPasswordHash;
      
      var data = adminSheet.getDataRange().getValues();
      var headers = data[0];
      var idColIdx = headers.indexOf('id');
      var passwordColIdx = headers.indexOf('password');
      
      if (idColIdx !== -1 && passwordColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (Number(data[i][idColIdx]) === adminId) {
            adminSheet.getRange(i + 1, passwordColIdx + 1).setValue(newPasswordHash);
            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 ID를 가진 관리자를 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 6. 관리자 정보 수정 액션 (아이디, 이름, 이메일)
    else if (action === 'updateAdminInfo') {
      var adminSheet = ss.getSheetByName('관리자 계정');
      if (!adminSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '관리자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var adminId = Number(payload.adminId);
      var username = payload.username.toString().trim();
      var name = payload.name.toString().trim();
      var email = payload.email.toString().trim();
      
      var data = adminSheet.getDataRange().getValues();
      var headers = data[0];
      var idColIdx = headers.indexOf('id');
      var usernameColIdx = headers.indexOf('username');
      var nameColIdx = headers.indexOf('name');
      var emailColIdx = headers.indexOf('email');
      
      // 아이디 중복 체크 (자신을 제외한 다른 계정)
      if (usernameColIdx !== -1 && idColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          var dbId = Number(data[i][idColIdx]);
          var dbUser = data[i][usernameColIdx].toString().trim();
          if (dbId !== adminId && dbUser === username) {
            return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '이미 존재하는 관리자 ID입니다.'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      
      // 정보 업데이트
      if (idColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (Number(data[i][idColIdx]) === adminId) {
            if (usernameColIdx !== -1) adminSheet.getRange(i + 1, usernameColIdx + 1).setValue(username);
            if (nameColIdx !== -1) adminSheet.getRange(i + 1, nameColIdx + 1).setValue(name);
            if (emailColIdx !== -1) adminSheet.getRange(i + 1, emailColIdx + 1).setValue(email);
            
            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 ID를 가진 관리자를 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 사용자 계정 조회 액션
    else if (action === 'getUsers') {
      var userDbSheet = ss.getSheetByName('사용자 계정');
      if (!userDbSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '사용자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var data = userDbSheet.getDataRange().getValues();
      var users = [];
      if (data.length > 1) {
        var headers = data[0];
        var usernameColIdx = -1, nameColIdx = -1, teamColIdx = -1, emailColIdx = -1;
        for (var j = 0; j < headers.length; j++) {
          var h = headers[j].toString().trim().toLowerCase();
          if (['사원 id', '사원id', '아이디', 'id', 'username', '사번', '사원번호'].indexOf(h) !== -1) usernameColIdx = j;
          else if (['이름', 'name', '성명'].indexOf(h) !== -1) nameColIdx = j;
          else if (['소속팀', '소속 팀', '부서', 'team', 'dept', '소속'].indexOf(h) !== -1) teamColIdx = j;
          else if (['이메일', 'email', '메일'].indexOf(h) !== -1) emailColIdx = j;
        }
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          users.push({
            id: i, // 임시 고유 ID로 행 번호 활용
            username: (usernameColIdx !== -1 && row[usernameColIdx] !== undefined && row[usernameColIdx] !== null) ? row[usernameColIdx].toString().trim() : '',
            name: (nameColIdx !== -1 && row[nameColIdx] !== undefined && row[nameColIdx] !== null) ? row[nameColIdx].toString().trim() : '',
            team: (teamColIdx !== -1 && row[teamColIdx] !== undefined && row[teamColIdx] !== null) ? row[teamColIdx].toString().trim() : '',
            email: (emailColIdx !== -1 && row[emailColIdx] !== undefined && row[emailColIdx] !== null) ? row[emailColIdx].toString().trim() : ''
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'success', users: users}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 신규 사용자 추가 액션
    else if (action === 'addUser') {
      var userDbSheet = ss.getSheetByName('사용자 계정');
      if (!userDbSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '사용자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var username = payload.username.toString().trim();
      var name = payload.name.toString().trim();
      var team = payload.team.toString().trim();
      var password = payload.password.toString().trim(); // 이미 해싱된 상태
      var email = payload.email ? payload.email.toString().trim() : (username + "@swei.co.kr");

      var data = userDbSheet.getDataRange().getValues();
      var headers = data[0];
      var usernameColIdx = -1, nameColIdx = -1, teamColIdx = -1, emailColIdx = -1, passwordColIdx = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j].toString().trim().toLowerCase();
        if (['사원 id', '사원id', '아이디', 'id', 'username', '사번', '사원번호'].indexOf(h) !== -1) usernameColIdx = j;
        else if (['이름', 'name', '성명'].indexOf(h) !== -1) nameColIdx = j;
        else if (['소속팀', '소속 팀', '부서', 'team', 'dept', '소속'].indexOf(h) !== -1) teamColIdx = j;
        else if (['이메일', 'email', '메일'].indexOf(h) !== -1) emailColIdx = j;
        else if (['비밀번호', 'password', 'pw', '비번', '패스워드', '암호'].indexOf(h) !== -1) passwordColIdx = j;
      }

      if (usernameColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][usernameColIdx].toString().trim() === username) {
            return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '이미 존재하는 사원 ID입니다.'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      var newRow = [];
      for (var j = 0; j < headers.length; j++) {
        if (j === usernameColIdx) newRow.push(username);
        else if (j === nameColIdx) newRow.push(name);
        else if (j === teamColIdx) newRow.push(team);
        else if (j === emailColIdx) newRow.push(email);
        else if (j === passwordColIdx) newRow.push(password);
        else newRow.push('');
      }
      userDbSheet.appendRow(newRow);

      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 사용자 삭제 액션
    else if (action === 'deleteUser') {
      var userDbSheet = ss.getSheetByName('사용자 계정');
      if (!userDbSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '사용자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var username = payload.username.toString().trim();

      var data = userDbSheet.getDataRange().getValues();
      var headers = data[0];
      var usernameColIdx = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j].toString().trim().toLowerCase();
        if (['사원 id', '사원id', '아이디', 'id', 'username', '사번', '사원번호'].indexOf(h) !== -1) usernameColIdx = j;
      }

      if (usernameColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][usernameColIdx].toString().trim() === username) {
            userDbSheet.deleteRow(i + 1);
            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 사원을 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 사용자 비밀번호 변경 액션
    else if (action === 'changeUserPassword') {
      var userDbSheet = ss.getSheetByName('사용자 계정');
      if (!userDbSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '사용자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var username = payload.username.toString().trim();
      var newPasswordHash = payload.newPasswordHash;

      var data = userDbSheet.getDataRange().getValues();
      var headers = data[0];
      var usernameColIdx = -1, passwordColIdx = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j].toString().trim().toLowerCase();
        if (['사원 id', '사원id', '아이디', 'id', 'username', '사번', '사원번호'].indexOf(h) !== -1) usernameColIdx = j;
        else if (['비밀번호', 'password', 'pw', '비번', '패스워드', '암호'].indexOf(h) !== -1) passwordColIdx = j;
      }

      if (usernameColIdx !== -1 && passwordColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][usernameColIdx].toString().trim() === username) {
            userDbSheet.getRange(i + 1, passwordColIdx + 1).setValue(newPasswordHash);
            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 사원을 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 사용자 정보 수정 액션
    else if (action === 'updateUserInfo') {
      var userDbSheet = ss.getSheetByName('사용자 계정');
      if (!userDbSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '사용자 계정 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var oldUsername = payload.oldUsername.toString().trim();
      var username = payload.username.toString().trim();
      var name = payload.name.toString().trim();
      var team = payload.team.toString().trim();
      var email = payload.email.toString().trim();

      var data = userDbSheet.getDataRange().getValues();
      var headers = data[0];
      var usernameColIdx = -1, nameColIdx = -1, teamColIdx = -1, emailColIdx = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j].toString().trim().toLowerCase();
        if (['사원 id', '사원id', '아이디', 'id', 'username', '사번', '사원번호'].indexOf(h) !== -1) usernameColIdx = j;
        else if (['이름', 'name', '성명'].indexOf(h) !== -1) nameColIdx = j;
        else if (['소속팀', '소속 팀', '부서', 'team', 'dept', '소속'].indexOf(h) !== -1) teamColIdx = j;
        else if (['이메일', 'email', '메일'].indexOf(h) !== -1) emailColIdx = j;
      }

      // 사원 ID 중복 체크 (다른 사원과 중복)
      if (usernameColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          var dbUser = data[i][usernameColIdx].toString().trim();
          if (dbUser !== oldUsername && dbUser === username) {
            return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '이미 존재하는 사원 ID입니다.'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      if (usernameColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][usernameColIdx].toString().trim() === oldUsername) {
            if (usernameColIdx !== -1) userDbSheet.getRange(i + 1, usernameColIdx + 1).setValue(username);
            if (nameColIdx !== -1) userDbSheet.getRange(i + 1, nameColIdx + 1).setValue(name);
            if (teamColIdx !== -1) userDbSheet.getRange(i + 1, teamColIdx + 1).setValue(team);
            if (emailColIdx !== -1) userDbSheet.getRange(i + 1, emailColIdx + 1).setValue(email);

            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 사원을 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // --- 기존 액션: 전산 문의 내역 목록 저장 ---
    else if (action === 'saveRequests') {
      var requests = payload.requests || [];
      
      // 관리자 이메일 목록 미리 로드
      var adminEmails = getAllAdminEmails(ss);
      
      // 1. 기존 데이터 읽기 (상태 변화 확인 및 중복 메일 발송 방지용)
      var oldStatusMap = {};
      try {
        var oldData = sheets.requests.getDataRange().getValues();
        if (oldData && oldData.length > 1) {
          var oldHeaders = oldData[0];
          var idColIdx = oldHeaders.indexOf('id');
          var statusColIdx = oldHeaders.indexOf('status');
          if (idColIdx !== -1 && statusColIdx !== -1) {
            for (var k = 1; k < oldData.length; k++) {
              var rowId = Number(oldData[k][idColIdx]);
              var rowStatus = oldData[k][statusColIdx] ? oldData[k][statusColIdx].toString().trim() : '';
              if (!isNaN(rowId)) {
                oldStatusMap[rowId] = rowStatus;
              }
            }
          }
        }
      } catch(err) {
        Logger.log("기존 상태 읽기 오류 (무시하고 진행): " + err.toString());
      }

      sheets.requests.clear();
      var reqHeaders = ['id', 'name', 'team', 'email', 'category', 'title', 'desc', 'images', 'files', 'fileAttachments', 'status', 'date', 'rejectReason', 'completeReason', 'resolution', 'password'];
      
      if (requests.length === 0) {
        sheets.requests.appendRow(reqHeaders);
      } else {
        var reqRows = [reqHeaders];
        for (var i = 0; i < requests.length; i++) {
          var req = requests[i];
          
          // 메일 발송 조건 검사: 기존에 완료/반려 상태가 아니었는데 이번에 완료/반려로 전환되는 경우
          var oldStatus = oldStatusMap[req.id];
          if (req.status === '완료' && oldStatus !== '완료') {
            sendCompletionEmail(req);
          } else if (req.status === '반려' && oldStatus !== '반려') {
            sendRejectionEmail(req);
          }
          
          // 신규 접수 알림 메일 발송: 기존 문의 내역에 존재하지 않고(status가 정의되지 않음) 신규 등록되는 경우
          if (oldStatus === undefined) {
            sendNewRequestAlertToAdmins(req, adminEmails);
          }
          
          var row = [];
          for (var j = 0; j < reqHeaders.length; j++) {
            var key = reqHeaders[j];
            if (key === 'images' || key === 'files' || key === 'fileAttachments') {
              row.push(JSON.stringify(req[key] || []));
            } else {
              row.push(req[key] !== undefined ? req[key] : '');
            }
          }
          reqRows.push(row);
        }
        sheets.requests.getRange(1, 1, reqRows.length, reqHeaders.length).setValues(reqRows);
      }
      
      // --- 2. 지급설치내역 자동 기록 ---
      sheets.provision.clear();
      var provHeaders = ['일자', '요청자', '소속팀', '구분', '지급/설치내역', '해결과정'];
      var provRows = [provHeaders];
      
      for (var m = 0; m < requests.length; m++) {
        var r = requests[m];
        if (r.status === '완료' && (r.category === '프로그램 설치' || r.category === '소모품 필요')) {
          var dateObj = new Date(r.date);
          var dateStr = Utilities.formatDate(dateObj, "GMT+9", "yyyy-MM-dd HH:mm");
          provRows.push([
            dateStr,
            r.name || '',
            r.team || '',
            r.category || '',
            r.completeReason || '',
            r.resolution || ''
          ]);
        }
      }
      
      if (provRows.length === 1) {
        sheets.provision.appendRow(provHeaders);
      } else {
        sheets.provision.getRange(1, 1, provRows.length, provHeaders.length).setValues(provRows);
      }
      sheets.provision.getRange(1, 1, 1, provHeaders.length).setFontWeight("bold").setBackground("#EEF2FF");
      
      // --- 3. 실적 보고서 자동 렌더링 ---
      sheets.report.clear();
      
      var total = requests.length;
      var completed = 0;
      var inProgress = 0;
      var rejected = 0;
      
      var categoryCounts = {'고장/오류': 0, '프로그램 설치': 0, '소모품 필요': 0};
      var teamCounts = {};
      
      for (var n = 0; n < total; n++) {
        var reqItem = requests[n];
        if (reqItem.status === '완료') completed++;
        else if (reqItem.status === '반려') rejected++;
        else if (['접수', '처리중', '보류'].indexOf(reqItem.status) !== -1) inProgress++;
        
        if (categoryCounts[reqItem.category] !== undefined) {
          categoryCounts[reqItem.category]++;
        }
        
        if (reqItem.team) {
          teamCounts[reqItem.team] = (teamCounts[reqItem.team] || 0) + 1;
        }
      }
      
      var rate = total === 0 ? 0 : ((completed / total) * 100).toFixed(1);
      var nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
      
      sheets.report.getRange("A1").setValue("📋 IT 전산 문의 처리 실적 보고서").setFontSize(16).setFontWeight("bold");
      sheets.report.getRange("A2").setValue("작성 일시: " + nowStr).setFontColor("#64748B");
      
      // 종합 처리 현황
      sheets.report.getRange("A4").setValue("1. 종합 처리 현황").setFontSize(12).setFontWeight("bold");
      var summaryHeaders = ["구분", "접수 건수", "완료 건수", "진행 중 건수", "반려 건수", "처리율(%)"];
      var summaryValues = [
        ["당월 실적", total + "건", completed + "건", inProgress + "건", rejected + "건", rate + "%"]
      ];
      sheets.report.getRange(5, 1, 1, summaryHeaders.length).setValues([summaryHeaders]).setFontWeight("bold").setBackground("#EEF2FF");
      sheets.report.getRange(6, 1, 1, summaryHeaders.length).setValues(summaryValues);
      
      // 카테고리별 세부 실적
      sheets.report.getRange("A8").setValue("2. 카테고리별 세부 실적").setFontSize(12).setFontWeight("bold");
      var catHeaders = ["카테고리", "건수", "비율(%)"];
      var catValues = [
        ["고장/오류", categoryCounts["고장/오류"] + "건", (total === 0 ? 0 : (categoryCounts["고장/오류"]/total*100).toFixed(1)) + "%"],
        ["프로그램 설치", categoryCounts["프로그램 설치"] + "건", (total === 0 ? 0 : (categoryCounts["프로그램 설치"]/total*100).toFixed(1)) + "%"],
        ["소모품 필요", categoryCounts["소모품 필요"] + "건", (total === 0 ? 0 : (categoryCounts["소모품 필요"]/total*100).toFixed(1)) + "%"]
      ];
      sheets.report.getRange(9, 1, 1, catHeaders.length).setValues([catHeaders]).setFontWeight("bold").setBackground("#EEF2FF");
      sheets.report.getRange(10, 1, catValues.length, catHeaders.length).setValues(catValues);
      
      // 팀별 요청 순위 (Top 3)
      sheets.report.getRange("A14").setValue("3. 팀별 요청 순위 (Top 3)").setFontSize(12).setFontWeight("bold");
      var teamHeaders = ["순위", "소속 팀", "요청 건수"];
      var teamArray = [];
      for (var tKey in teamCounts) {
        teamArray.push({name: tKey, count: teamCounts[tKey]});
      }
      teamArray.sort(function(a, b) { return b.count - a.count; });
      
      var teamValues = [];
      for (var p = 0; p < Math.min(3, teamArray.length); p++) {
        teamValues.push([(p+1) + "위", teamArray[p].name, teamArray[p].count + "건"]);
      }
      if (teamValues.length === 0) {
        teamValues.push(["-", "데이터 없음", "0건"]);
      }
      sheets.report.getRange(15, 1, 1, teamHeaders.length).setValues([teamHeaders]).setFontWeight("bold").setBackground("#EEF2FF");
      sheets.report.getRange(16, 1, teamValues.length, teamHeaders.length).setValues(teamValues);
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 7. 챗봇 가이드 저장/수정 액션
    else if (action === 'saveChatbotGuide') {
      var chatbotSheet = ss.getSheetByName('챗봇 가이드');
      if (!chatbotSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '챗봇 가이드 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var key = payload.key.toString().trim();
      var title = payload.title.toString().trim();
      var steps = payload.steps ? payload.steps.join('\n') : '';
      var tip = payload.tip ? payload.tip.toString().trim() : '';
      var downloads = payload.downloads ? JSON.stringify(payload.downloads) : '[]';
      
      var data = chatbotSheet.getDataRange().getValues();
      var headers = data[0];
      var keyColIdx = headers.indexOf('key');
      
      var targetRowIdx = -1;
      if (keyColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][keyColIdx].toString().trim() === key) {
            targetRowIdx = i + 1; // 1-indexed row number
            break;
          }
        }
      }
      
      if (targetRowIdx !== -1) {
        // 기존 가이드 업데이트
        for (var j = 0; j < headers.length; j++) {
          var col = headers[j];
          if (col === 'title') chatbotSheet.getRange(targetRowIdx, j + 1).setValue(title);
          else if (col === 'steps') chatbotSheet.getRange(targetRowIdx, j + 1).setValue(steps);
          else if (col === 'tip') chatbotSheet.getRange(targetRowIdx, j + 1).setValue(tip);
          else if (col === 'downloads') chatbotSheet.getRange(targetRowIdx, j + 1).setValue(downloads);
          else if (col === 'date') chatbotSheet.getRange(targetRowIdx, j + 1).setValue(new Date());
        }
      } else {
        // 신규 가이드 등록
        var maxId = 0;
        var idColIdx = headers.indexOf('id');
        if (idColIdx !== -1) {
          for (var i = 1; i < data.length; i++) {
            var currentId = Number(data[i][idColIdx]);
            if (!isNaN(currentId) && currentId > maxId) {
              maxId = currentId;
            }
          }
        }
        var newId = maxId + 1;
        
        var newRow = [];
        for (var j = 0; j < headers.length; j++) {
          var col = headers[j];
          if (col === 'id') newRow.push(newId);
          else if (col === 'key') newRow.push(key);
          else if (col === 'title') newRow.push(title);
          else if (col === 'steps') newRow.push(steps);
          else if (col === 'tip') newRow.push(tip);
          else if (col === 'downloads') newRow.push(downloads);
          else if (col === 'date') newRow.push(new Date());
          else newRow.push('');
        }
        chatbotSheet.appendRow(newRow);
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 8. 챗봇 가이드 삭제 액션
    else if (action === 'deleteChatbotGuide') {
      var chatbotSheet = ss.getSheetByName('챗봇 가이드');
      if (!chatbotSheet) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '챗봇 가이드 시트가 존재하지 않습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var key = payload.key.toString().trim();
      
      var data = chatbotSheet.getDataRange().getValues();
      var headers = data[0];
      var keyColIdx = headers.indexOf('key');
      
      if (keyColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          if (data[i][keyColIdx].toString().trim() === key) {
            chatbotSheet.deleteRow(i + 1);
            return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 키를 가진 가이드를 찾을 수 없습니다.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    else {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unknown action: ' + action}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// IT지원센터 전산 문의 처리 완료 안내 메일 전송
function sendCompletionEmail(req) {
  if (!req.email || !req.email.includes('@')) {
    Logger.log("이메일 주소가 없거나 유효하지 않아 알림 메일을 발송하지 못했습니다: " + (req.name || '알 수 없음'));
    return;
  }
  
  var subject = "[IT지원센터] 신청하신 전산 문의 건의 처리가 완료되었습니다. (No." + req.id + ")";
  
  // 프리미엄 HTML 이메일 템플릿
  var htmlBody = 
    "<div style='font-family: \"Malgun Gothic\", \"Apple SD Gothic Neo\", sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
      "<div style='background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%); padding: 28px 24px; text-align: center; color: #ffffff;'>" +
        "<h2 style='margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.05em;'>전산 문의 완료 안내</h2>" +
        "<p style='margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;'>요청하신 전산 업무가 성공적으로 처리 완료되었습니다.</p>" +
      "</div>" +
      "<div style='padding: 28px 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;'>" +
        "<p style='font-size: 15px; margin-top: 0;'>안녕하세요, <strong>" + req.name + "</strong> 님.</p>" +
        "<p style='font-size: 14px; color: #475569;'>신청하신 전산 문의 내역의 조치 결과를 아래와 같이 안내해 드립니다.</p>" +
        
        "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;'>" +
          "<table style='width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;'>" +
            "<tr>" +
              "<th style='width: 90px; padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>문의 구분</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 500;'>" + req.category + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>문의 제목</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 500;'>" + (req.title || '-') + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>상세 내용</th>" +
              "<td style='padding: 6px 0; color: #334155; white-space: pre-wrap; font-size: 13px;'>" + req.desc + "</td>" +
            "</tr>" +
          "</table>" +
        "</div>" +

        "<h3 style='font-size: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px; color: #4F46E5; font-weight: 700; margin-bottom: 12px;'>🛠️ 처리 완료 내역</h3>" +
        "<div style='background-color: #EEF2FF; border-left: 4px solid #4F46E5; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 14px; color: #312E81; font-weight: 600;'>" +
          (req.completeReason || "정상적으로 완료되었습니다.") +
        "</div>" +
        
        (req.resolution ? 
          ("<div style='margin-bottom: 20px; font-size: 13.5px; color: #475569;'>" +
            "<strong style='color: #1e293b; display: block; margin-bottom: 6px;'>📍 세부 조치 사항:</strong>" +
            "<div style='padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; white-space: pre-wrap; line-height: 1.5; color: #334155;'>" + req.resolution + "</div>" +
          "</div>") : "") +

        "<p style='font-size: 13.5px; color: #475569; margin-top: 28px;'>추가적인 문의 사항이나 미흡한 부분이 있을 경우 IT지원센터로 연락 부탁드립니다. 감사합니다.</p>" +
      "</div>" +
      "<div style='background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #f1f5f9;'>" +
        "본 메일은 시스템에 의해 자동 발송된 송신전용 메일입니다.<br>" +
        "© IT지원센터. All rights reserved." +
      "</div>" +
    "</div>";

  try {
    MailApp.sendEmail({
      to: req.email,
      subject: subject,
      htmlBody: htmlBody,
      name: "성우전자 전산"
    });
    Logger.log("완료 알림 메일 발송 성공: " + req.email);
  } catch (err) {
    Logger.log("메일 발송 중 오류 발생: " + err.toString());
  }
}

// IT지원센터 전산 문의 처리 반려 안내 메일 전송
function sendRejectionEmail(req) {
  if (!req.email || !req.email.includes('@')) {
    Logger.log("이메일 주소가 없거나 유효하지 않아 반려 알림 메일을 발송하지 못했습니다: " + (req.name || '알 수 없음'));
    return;
  }
  
  var subject = "[IT지원센터] 신청하신 전산 문의 건이 반려되었습니다. (No." + req.id + ")";
  
  // 프리미엄 HTML 이메일 템플릿 (Red / Crimson 계열 테마)
  var htmlBody = 
    "<div style='font-family: \"Malgun Gothic\", \"Apple SD Gothic Neo\", sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
      "<div style='background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 28px 24px; text-align: center; color: #ffffff;'>" +
        "<h2 style='margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.05em;'>전산 문의 반려 안내</h2>" +
        "<p style='margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;'>요청하신 전산 업무 처리가 불가능하여 반려 처리되었습니다.</p>" +
      "</div>" +
      "<div style='padding: 28px 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;'>" +
        "<p style='font-size: 15px; margin-top: 0;'>안녕하세요, <strong>" + req.name + "</strong> 님.</p>" +
        "<p style='font-size: 14px; color: #475569;'>신청하신 전산 문의 건의 조치 결과(반려)를 아래와 같이 안내해 드립니다.</p>" +
        
        "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;'>" +
          "<table style='width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;'>" +
            "<tr>" +
              "<th style='width: 90px; padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>문의 구분</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 500;'>" + req.category + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>문의 제목</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 500;'>" + (req.title || '-') + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>상세 내용</th>" +
              "<td style='padding: 6px 0; color: #334155; white-space: pre-wrap; font-size: 13px;'>" + req.desc + "</td>" +
            "</tr>" +
          "</table>" +
        "</div>" +

        "<h3 style='font-size: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px; color: #DC2626; font-weight: 700; margin-bottom: 12px;'>⚠️ 반려 사유</h3>" +
        "<div style='background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 14px; color: #991B1B; font-weight: 600;'>" +
          (req.rejectReason || "상세 반려 사유가 입력되지 않았습니다.") +
        "</div>" +

        "<p style='font-size: 13.5px; color: #475569; margin-top: 28px;'>반려 사유를 보완하시어 대시보드에서 문의를 수정 및 재접수하시거나, 상세한 내용 협의는 IT지원센터로 연락 부탁드립니다. 감사합니다.</p>" +
      "</div>" +
      "<div style='background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #f1f5f9;'>" +
        "본 메일은 시스템에 의해 자동 발송된 송신전용 메일입니다.<br>" +
        "© IT지원센터. All rights reserved." +
      "</div>" +
    "</div>";

  try {
    MailApp.sendEmail({
      to: req.email,
      subject: subject,
      htmlBody: htmlBody,
      name: "성우전자 전산"
    });
    Logger.log("반려 알림 메일 발송 성공: " + req.email);
  } catch (err) {
    Logger.log("메일 발송 중 오류 발생: " + err.toString());
  }
}

// 등록된 모든 관리자의 유효한 이메일 목록 가져오기
function getAllAdminEmails(ss) {
  var emails = [];
  var adminSheet = ss.getSheetByName('관리자 계정');
  if (adminSheet) {
    var data = adminSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var emailColIdx = headers.indexOf('email');
      if (emailColIdx !== -1) {
        for (var i = 1; i < data.length; i++) {
          var email = data[i][emailColIdx] ? data[i][emailColIdx].toString().trim() : '';
          if (email && email.includes('@')) {
            emails.push(email);
          }
        }
      }
    }
  }
  return emails;
}

// 관리자에게 신규 전산 문의 접수 알림 메일 발송
function sendNewRequestAlertToAdmins(req, adminEmails) {
  if (!adminEmails || adminEmails.length === 0) {
    Logger.log("관리자 이메일 목록이 비어있어 알림 메일을 발송하지 못했습니다.");
    return;
  }
  
  var subject = "[IT지원센터] 🔔 새로운 전산 문의가 접수되었습니다. (No." + req.id + ")";
  
  // 딥 퍼플 테마 적용 프리미엄 HTML 이메일 템플릿
  var htmlBody = 
    "<div style='font-family: \"Malgun Gothic\", \"Apple SD Gothic Neo\", sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #dcd6f7; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
      "<div style='background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 28px 24px; text-align: center; color: #ffffff;'>" +
        "<h2 style='margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.05em;'>🔔 신규 문의 접수 알림</h2>" +
        "<p style='margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;'>새로운 IT 지원 요청이 등록되었습니다. 상세 내용을 확인해 주세요.</p>" +
      "</div>" +
      "<div style='padding: 28px 24px; background-color: #ffffff; color: #1e293b; line-height: 1.6;'>" +
        "<p style='font-size: 15px; margin-top: 0; font-weight: 600;'>안녕하세요, IT지원센터 관리자님.</p>" +
        "<p style='font-size: 14px; color: #475569;'>임직원으로부터 신규 전산 문의가 접수되어 안내해 드립니다.</p>" +
        
        "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;'>" +
          "<table style='width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;'>" +
            "<tr>" +
              "<th style='width: 90px; padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>요청 번호</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 700;'>No." + req.id + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>요청자</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 500;'>" + req.name + " (" + (req.team || '소속 없음') + ")</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>문의 구분</th>" +
              "<td style='padding: 6px 0; color: #1e293b; font-weight: 500;'>" + req.category + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>문의 제목</th>" +
              "<td style='padding: 6px 0; color: #4338ca; font-weight: 600;'>" + (req.title || '-') + "</td>" +
            "</tr>" +
            "<tr>" +
              "<th style='padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;'>상세 내용</th>" +
              "<td style='padding: 6px 0; color: #334155; white-space: pre-wrap; font-size: 13px; line-height: 1.5;'>" + req.desc + "</td>" +
            "</tr>" +
          "</table>" +
        "</div>" +

        "<div style='text-align: center; margin: 30px 0 10px 0;'>" +
          "<a href='" + DASHBOARD_URL + "' target='_blank' style='background-color: #4338ca; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);'>IT지원센터 열기</a>" +
        "</div>" +
      "</div>" +
      "<div style='background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #f1f5f9;'>" +
        "본 메일은 시스템에 의해 자동 발송된 송신전용 메일입니다.<br>" +
        "© IT지원센터. All rights reserved." +
      "</div>" +
    "</div>";

  try {
    MailApp.sendEmail({
      to: adminEmails.join(','),
      subject: subject,
      htmlBody: htmlBody,
      name: "성우전자 전산"
    });
    Logger.log("관리자 알림 메일 발송 성공 (수신인 수: " + adminEmails.length + ")");
  } catch (err) {
    Logger.log("관리자 알림 메일 발송 중 오류 발생: " + err.toString());
  }
}

// 구글 서버에 외부 네트워크 통신 권한(UrlFetchApp)을 승인받기 위한 강제 활성화 함수
function triggerAuthorization() {
  UrlFetchApp.fetch("https://generativelanguage.googleapis.com/");
  Logger.log("권한 승인 성공!");
}

