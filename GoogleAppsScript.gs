/**
 * ========================================================
 * 이 코드는 구글 스프레드시트를 백엔드 서버(API)로 사용하기 위한 구글 앱스 스크립트 코드입니다.
 * 만약 로컬 서버(Node.js) 대신 구글 스프레드시트를 계속 사용하고 싶으시다면 아래 절차를 따르세요.
 * 
 * [적용 방법]
 * 1. 구글 스프레드시트를 새로 만듭니다.
 * 2. 상단 메뉴에서 [확장 프로그램] -> [Apps Script]를 클릭합니다.
 * 3. 기존에 있던 코드를 모두 지우고, 이 파일의 내용을 복사해서 붙여넣습니다.
 * 4. 우측 상단의 [배포] -> [새 배포]를 클릭합니다.
 * 5. 유형 선택: [웹 앱(Web App)]
 * 6. 액세스 권한: [모든 사용자(Anyone)] 로 설정하고 배포합니다.
 * 7. 발급받은 '웹 앱 URL'을 복사하여 대시보드의 script.js 파일 상단에 있는
 *    GOOGLE_SCRIPT_URL 변수에 붙여넣으세요.
 * ========================================================
 */

// 구글 스프레드시트 주소를 아래 따옴표 안에 붙여넣으세요.
var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1FAPhHTQ7VsiCNcwET5HkR1RUNrIfqPJMX5R0WFDcFos/edit?gid=0#gid=0';

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
  // 1. 처리현황 시트 확보
  var requestSheet = ss.getSheetByName('처리현황');
  if (!requestSheet) {
    var sheets = ss.getSheets();
    if (sheets.length > 0) {
      requestSheet = sheets[0];
      requestSheet.setName('처리현황');
    } else {
      requestSheet = ss.insertSheet('처리현황');
    }
  }
  
  // 2. 관리자 계정 관리 시트 확보 및 컬럼 세분화 마이그레이션
  var adminSheet = ss.getSheetByName('관리자 계정 관리');
  if (!adminSheet) {
    var legacyAdminSheet = ss.getSheetByName('관리자');
    if (legacyAdminSheet) {
      adminSheet = legacyAdminSheet;
      adminSheet.setName('관리자 계정 관리');
    } else {
      adminSheet = ss.insertSheet('관리자 계정 관리');
    }
  }
  
  // 관리자 시트 헤더 컬럼 검증 및 마이그레이션 (['id', 'username', 'name', 'password', 'date'])
  var adminData = adminSheet.getDataRange().getValues();
  var targetHeaders = ['id', 'username', 'name', 'password', 'date'];
  if (adminData.length > 0) {
    var currentHeaders = adminData[0];
    // 구형 컬럼 구조(username이 없음)인 경우 자동 마이그레이션
    if (currentHeaders.indexOf('username') === -1) {
      var newRows = [targetHeaders];
      var nameIdx = currentHeaders.indexOf('name');
      var idIdx = currentHeaders.indexOf('id');
      var pwIdx = currentHeaders.indexOf('password');
      var dateIdx = currentHeaders.indexOf('date');
      
      for (var i = 1; i < adminData.length; i++) {
        var row = adminData[i];
        var idVal = idIdx !== -1 ? row[idIdx] : new Date().getTime() + i;
        var usernameVal = nameIdx !== -1 ? row[nameIdx] : 'admin';
        var nameVal = usernameVal; // 기존의 로그인 ID를 임시 실명으로 복사
        var pwVal = pwIdx !== -1 ? row[pwIdx] : '';
        var dateVal = dateIdx !== -1 ? row[dateIdx] : '';
        
        newRows.push([idVal, usernameVal, nameVal, pwVal, dateVal]);
      }
      
      adminSheet.clear();
      adminSheet.getRange(1, 1, newRows.length, targetHeaders.length).setValues(newRows);
      SpreadsheetApp.flush();
    }
  } else {
    adminSheet.appendRow(targetHeaders);
  }
  
  // 3. 실적 보고서 및 지급/설치 내역 시트
  var reportSheet = getOrCreateSheet(ss, '실적 보고서');
  var provisionSheet = getOrCreateSheet(ss, '지급/설치 내역');
  
  // 4. 사용자 db 시트 확보 및 자동 마이그레이션
  var userSheet = ss.getSheetByName('사용자 db');
  if (!userSheet) {
    userSheet = ss.insertSheet('사용자 db');
  }
  var userData = userSheet.getDataRange().getValues();
  var userHeaders = ['이름', '부서명', 'id', '비번', '계열사', '휴대전화', '이메일'];
  
  if (userData.length > 0 && userData[0].length > 0 && userData[0][0] !== '') {
    var currentHeaders = userData[0];
    
    // 현재 헤더 구조가 목표 헤더 구조와 일치하는지 대조
    var needMigration = false;
    if (currentHeaders.length !== userHeaders.length) {
      needMigration = true;
    } else {
      for (var k = 0; k < userHeaders.length; k++) {
        if (currentHeaders[k] !== userHeaders[k]) {
          needMigration = true;
          break;
        }
      }
    }
    
    if (needMigration) {
      // 기존 인덱스 감지
      var oldNameIdx = currentHeaders.indexOf('이름');
      var oldTeamIdx = currentHeaders.indexOf('부서명');
      var oldIdIdx = currentHeaders.indexOf('id');
      var oldPwIdx = currentHeaders.indexOf('비번');
      var oldAffiliationIdx = currentHeaders.indexOf('계열사');
      var oldPhoneIdx = currentHeaders.indexOf('휴대전화');
      var oldEmailIdx = currentHeaders.indexOf('이메일');
      
      var newRows = [userHeaders]; // 첫 번째 행은 새로운 헤더 구조로 세팅
      
      for (var i = 1; i < userData.length; i++) {
        var row = userData[i];
        
        var nameVal = oldNameIdx !== -1 ? row[oldNameIdx] : '';
        var teamVal = oldTeamIdx !== -1 ? row[oldTeamIdx] : '';
        var idVal = oldIdIdx !== -1 ? row[oldIdIdx] : '';
        var pwVal = oldPwIdx !== -1 ? row[oldPwIdx] : '';
        var affiliationVal = oldAffiliationIdx !== -1 ? row[oldAffiliationIdx] : '';
        var phoneVal = oldPhoneIdx !== -1 ? row[oldPhoneIdx] : '';
        var emailVal = oldEmailIdx !== -1 ? row[oldEmailIdx] : '';
        
        // 새로운 규격 순서로 행 빌드
        newRows.push([nameVal, teamVal, idVal, pwVal, affiliationVal, phoneVal, emailVal]);
      }
      
      userSheet.clear();
      userSheet.getRange(1, 1, newRows.length, userHeaders.length).setValues(newRows);
      SpreadsheetApp.flush();
    }
  } else {
    // 시트가 아예 비어있는 경우
    userSheet.appendRow(userHeaders);
  }
  
  return {
    requests: requestSheet,
    admins: adminSheet,
    report: reportSheet,
    provision: provisionSheet,
    userDb: userSheet
  };
}

// 유틸리티: 문자열 SHA-256 단방향 해싱 함수 구현
function sha256(input) {
  // 안전장치: 인자가 없거나 null인 경우 빈 문자열로 대체하여 에러 방지
  if (input === null || input === undefined) {
    input = "";
  }
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var output = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    output += byteString;
  }
  return output;
}

// 안전장치: 스프레드시트 관리자 및 사용자 db 시트에 직접 수기로 입력된 평문 비밀번호 자동 감지 및 암호화(SHA-256) 변환
function checkAndHashPlainPasswords(sheets) {
  // 1. 관리자 계정 시트 해싱
  var adminSheet = sheets.admins;
  var adminData = adminSheet.getDataRange().getValues();
  if (adminData.length > 1) {
    var headers = adminData[0];
    var usernameIdx = headers.indexOf('username');
    var pwIdx = headers.indexOf('password');
    
    if (usernameIdx !== -1 && pwIdx !== -1) {
      var updated = false;
      for (var i = 1; i < adminData.length; i++) {
        var row = adminData[i];
        var username = row[usernameIdx];
        var password = String(row[pwIdx]);
        
        // 패스워드가 기록되어 있으나 64자 해시 형태가 아닐 경우 평문으로 간주
        if (password && password.length !== 64) {
          // '아이디 + ":" + 비밀번호' 형식으로 자동 해싱 후 시트 갱신
          var hashedPassword = sha256(username + ":" + password);
          adminSheet.getRange(i + 1, pwIdx + 1).setValue(hashedPassword);
          updated = true;
        }
      }
      if (updated) {
        SpreadsheetApp.flush();
      }
    }
  }

  // 2. 사용자 db 시트 해싱
  var userSheet = sheets.userDb;
  var userData = userSheet.getDataRange().getValues();
  if (userData.length > 1) {
    var headers = userData[0];
    var idIdx = headers.indexOf('id');
    var pwIdx = headers.indexOf('비번');
    
    if (idIdx !== -1 && pwIdx !== -1) {
      var updated = false;
      for (var i = 1; i < userData.length; i++) {
        var row = userData[i];
        var userId = String(row[idIdx]);
        var password = String(row[pwIdx]);
        
        // 패스워드가 기록되어 있으나 64자 해시 형태가 아닐 경우 평문으로 간주
        if (password && password.length !== 64) {
          // '아이디 + ":" + 비밀번호' 형식으로 자동 해싱 후 시트 갱신
          var hashedPassword = sha256(userId + ":" + password);
          userSheet.getRange(i + 1, pwIdx + 1).setValue(hashedPassword);
          updated = true;
        }
      }
      if (updated) {
        SpreadsheetApp.flush();
      }
    }
  }
}

// 유틸리티: 사용자가 유효한 관리자 또는 임직원인지 검증
function validateUser(sheets, username, passwordHash) {
  if (!username || !passwordHash) return false;
  
  // 1. 기본 마스터 관리자 검증
  if (username === 'admin' && passwordHash === 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c') {
    return true;
  }
  
  // 2. 관리자 계정 관리 시트 검증
  var adminData = sheets.admins.getDataRange().getValues();
  if (adminData.length > 1) {
    var headers = adminData[0];
    var usernameIdx = headers.indexOf('username');
    var pwIdx = headers.indexOf('password');
    if (usernameIdx !== -1 && pwIdx !== -1) {
      for (var i = 1; i < adminData.length; i++) {
        var row = adminData[i];
        if (row[usernameIdx] === username && row[pwIdx] === passwordHash) {
          return true;
        }
      }
    }
  }
  
  // 3. 사용자 db 시트 검증
  var userData = sheets.userDb.getDataRange().getValues();
  if (userData.length > 1) {
    var headers = userData[0];
    var idIdx = headers.indexOf('id');
    var pwIdx = headers.indexOf('비번');
    if (idIdx !== -1 && pwIdx !== -1) {
      for (var i = 1; i < userData.length; i++) {
        var row = userData[i];
        if (String(row[idIdx]) === username && String(row[pwIdx]) === passwordHash) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// 데이터 조회 (GET 요청 처리)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById("1FAPhHTQ7VsiCNcwET5HkR1RUNrIfqPJMX5R0WFDcFos");
    var sheets = getOrInitializeSheets(ss);
    
    // 수기 등록된 평문 암호 자동 보안 변환 실행
    checkAndHashPlainPasswords(sheets);
    
    var username = e.parameter.username;
    var passwordHash = e.parameter.passwordHash;
    
    if (!validateUser(sheets, username, passwordHash)) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unauthorized'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
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
            
            if (key === 'images') {
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
    
    // 보안 강화: doGet 요청 시 관리자 목록(admins)은 웹 브라우저로 전송하지 않고 누락
    var result = {
      status: 'success',
      requests: parseSheetData(sheets.requests)
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
    var ss = SpreadsheetApp.openById("1FAPhHTQ7VsiCNcwET5HkR1RUNrIfqPJMX5R0WFDcFos");
    var payload = JSON.parse(e.postData.contents);
    var sheets = getOrInitializeSheets(ss);
    
    // 수기 등록된 평문 암호 자동 보안 변환 실행
    checkAndHashPlainPasswords(sheets);
    
    var action = payload.action;
    
    // --- 액션 A: 서버 사이드 로그인 검증 ---
    if (action === 'login') {
      var username = payload.username;
      var passwordHash = payload.passwordHash;
      var isValid = false;
      var role = '';
      var name = '';
      var team = '';
      var email = '';
      
      // 1. 기본 관리자 계정 (admin:1234) 검증
      if (username === 'admin' && passwordHash === 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c') {
        isValid = true;
        role = 'admin';
        name = '마스터 관리자';
        email = 'admin@swei.co.kr';
      } else {
        // 2. 스프레드시트의 '관리자 계정 관리' 데이터를 순회하며 일치 계정 확인
        var adminData = sheets.admins.getDataRange().getValues();
        if (adminData.length > 1) {
          var headers = adminData[0];
          var usernameIdx = headers.indexOf('username');
          var nameIdx = headers.indexOf('name');
          var pwIdx = headers.indexOf('password');
          
          if (usernameIdx !== -1 && pwIdx !== -1) {
            for (var i = 1; i < adminData.length; i++) {
              var row = adminData[i];
              if (row[usernameIdx] === username && row[pwIdx] === passwordHash) {
                isValid = true;
                role = 'admin';
                name = nameIdx !== -1 ? row[nameIdx] : username;
                email = username + '@swei.co.kr';
                break;
              }
            }
          }
        }
        
        // 3. 관리자가 아니면 '사용자 db' 시트에서 일치 계정 확인
        if (!isValid) {
          var userData = sheets.userDb.getDataRange().getValues();
          if (userData.length > 1) {
            var headers = userData[0];
            var nameIdx = headers.indexOf('이름');
            var idIdx = headers.indexOf('id');
            var pwIdx = headers.indexOf('비번');
            var teamIdx = headers.indexOf('부서명');
            var emailIdx = headers.indexOf('이메일'); // 신규 이메일 컬럼 인덱스 감지
            
            if (idIdx !== -1 && pwIdx !== -1) {
              for (var i = 1; i < userData.length; i++) {
                var row = userData[i];
                if (String(row[idIdx]) === username && String(row[pwIdx]) === passwordHash) {
                  isValid = true;
                  role = 'user';
                  name = nameIdx !== -1 ? row[nameIdx] : '';
                  team = teamIdx !== -1 ? row[teamIdx] : '';
                  
                  // 이메일 컬럼이 비어있지 않으면 그대로 사용하고, 비어있으면 기본 도메인 조합값 부여
                  var emailVal = emailIdx !== -1 ? String(row[emailIdx]) : '';
                  email = emailVal ? emailVal : (username + '@swei.co.kr');
                  break;
                }
              }
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success', 
        isValid: isValid,
        role: role,
        name: name,
        team: team,
        email: email
      })).setMimeType(ContentService.MimeType.JSON);
        
    // --- 액션 B: 서버 사이드 관리자 계정 신규 추가 (실명, ID, 암호) ---
    } else if (action === 'addAdmin') {
      var username = payload.username; // 로그인 아이디
      var name = payload.name;         // 실명
      var password = payload.password; // SHA-256 해시값
      
      var nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
      var newId = new Date().getTime();
      
      // 스프레드시트 '관리자 계정 관리' 시트에 한 줄 추가 (id, username, name, password, date)
      sheets.admins.appendRow([newId, username, name, password, nowStr]);
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
        .setMimeType(ContentService.MimeType.JSON);
        
    // --- 액션 C: 전산 문의 내역 목록 저장 ---
    } else if (action === 'saveRequests') {
      var requests = payload.requests || [];
      sheets.requests.clear();
      var reqHeaders = ['id', 'name', 'team', 'email', 'category', 'title', 'desc', 'images', 'status', 'date', 'rejectReason', 'completeReason', 'resolution', 'password'];
      
      if (requests.length === 0) {
        sheets.requests.appendRow(reqHeaders);
      } else {
        var reqRows = [reqHeaders];
        for (var i = 0; i < requests.length; i++) {
          var req = requests[i];
          var row = [];
          for (var j = 0; j < reqHeaders.length; j++) {
            var key = reqHeaders[j];
            if (key === 'images') {
              row.push(JSON.stringify(req[key] || []));
            } else {
              row.push(req[key] !== undefined ? req[key] : '');
            }
          }
          reqRows.push(row);
        }
        sheets.requests.getRange(1, 1, reqRows.length, reqHeaders.length).setValues(reqRows);
      }
      
      // --- 2. 지급/설치 내역 자동 기록 ---
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
        
    // --- 액션 D: 관리자 목록 조회 (패스워드 해시값 필터링 및 보안 누락) ---
    } else if (action === 'getAdmins') {
      var adminData = sheets.admins.getDataRange().getValues();
      var admins = [];
      if (adminData.length > 1) {
        var headers = adminData[0];
        var idIdx = headers.indexOf('id');
        var usernameIdx = headers.indexOf('username');
        var nameIdx = headers.indexOf('name');
        var dateIdx = headers.indexOf('date');
        
        for (var i = 1; i < adminData.length; i++) {
          var row = adminData[i];
          var obj = {
            id: idIdx !== -1 ? Number(row[idIdx]) : '',
            username: usernameIdx !== -1 ? row[usernameIdx] : '',
            name: nameIdx !== -1 ? row[nameIdx] : '',
            date: dateIdx !== -1 ? row[dateIdx] : ''
          };
          admins.push(obj);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', admins: admins}))
        .setMimeType(ContentService.MimeType.JSON);

    // --- 액션 E: 관리자 계정 삭제 (마스터 admin 계정 삭제 불가 통제) ---
    } else if (action === 'deleteAdmin') {
      var adminId = Number(payload.adminId);
      var adminData = sheets.admins.getDataRange().getValues();
      var deleted = false;
      
      if (adminData.length > 1) {
        var headers = adminData[0];
        var idIdx = headers.indexOf('id');
        var usernameIdx = headers.indexOf('username');
        
        if (idIdx !== -1) {
          for (var j = 1; j < adminData.length; j++) {
            var row = adminData[j];
            var currentId = Number(row[idIdx]);
            var currentUsername = usernameIdx !== -1 ? row[usernameIdx] : '';
            
            if (currentId === adminId) {
              if (currentUsername === 'admin') {
                return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '마스터 계정은 삭제할 수 없습니다.'}))
                  .setMimeType(ContentService.MimeType.JSON);
              }
              
              sheets.admins.deleteRow(j + 1);
              deleted = true;
              break;
            }
          }
        }
      }
      
      if (deleted) {
        return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 관리자를 찾을 수 없습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
    // --- 액션 F: 관리자 비밀번호 직접 변경 ---
    } else if (action === 'changeAdminPassword') {
      var adminId = Number(payload.adminId);
      var newPasswordHash = payload.newPasswordHash;
      var adminData = sheets.admins.getDataRange().getValues();
      var updated = false;
      
      if (adminData.length > 1) {
        var headers = adminData[0];
        var idIdx = headers.indexOf('id');
        var pwIdx = headers.indexOf('password');
        
        if (idIdx !== -1 && pwIdx !== -1) {
          for (var k = 1; k < adminData.length; k++) {
            var row = adminData[k];
            if (Number(row[idIdx]) === adminId) {
              sheets.admins.getRange(k + 1, pwIdx + 1).setValue(newPasswordHash);
              updated = true;
              break;
            }
          }
        }
      }
      
      if (updated) {
        return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: '해당 관리자를 찾을 수 없습니다.'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
    } else {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unknown action: ' + action}))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// CORS 설정 방지 (OPTIONS 요청 대응)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON);
}

// 수동 실행 및 마이그레이션 권한 승인을 위한 진입점 함수
function runInitialize() {
  var ss = SpreadsheetApp.openById("1FAPhHTQ7VsiCNcwET5HkR1RUNrIfqPJMX5R0WFDcFos");
  var sheets = getOrInitializeSheets(ss);
  checkAndHashPlainPasswords(sheets);
  Logger.log("성공적으로 초기화 및 마이그레이션이 완료되었습니다.");
}
