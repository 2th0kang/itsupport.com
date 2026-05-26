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

// 안전장치: 기존 단일 시트 구조를 다중 시트 구조로 안전 전환 및 초기화
function getOrInitializeSheets(ss) {
  // 1. 처리현황 시트 확보 (기존 첫 번째 시트의 이름이 '처리현황'이 아닐 경우 이름 변경하여 기존 데이터 보존)
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
  
  // 2. 관리자 계정 관리 시트 확보 (기존 '관리자' 시트가 있을 경우 이름을 '관리자 계정 관리'로 전환하여 보존)
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
  
  // 3. 실적 보고서 및 지급/설치 내역 시트 (기존에 없으면 생성)
  var reportSheet = getOrCreateSheet(ss, '실적 보고서');
  var provisionSheet = getOrCreateSheet(ss, '지급/설치 내역');
  
  return {
    requests: requestSheet,
    admins: adminSheet,
    report: reportSheet,
    provision: provisionSheet
  };
}

// 데이터 조회 (GET 요청 처리)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
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
    
    // 보안 강화: doGet 요청 시 관리자 목록(admins)은 웹 브라우저로 전송하지 않고 누락합니다.
    var result = {
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
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var payload = JSON.parse(e.postData.contents);
    var sheets = getOrInitializeSheets(ss);
    
    var action = payload.action;
    
    // --- 액션 A: 서버 사이드 로그인 검증 ---
    if (action === 'login') {
      var username = payload.username;
      var passwordHash = payload.passwordHash;
      var isValid = false;
      
      // 1. 기본 관리자 계정 (admin:1234) 검증
      if (username === 'admin' && passwordHash === 'f8e68e8d44bfb5314974a97f787d017ff6ac9d0046083f28665fcf96f0cef80c') {
        isValid = true;
      } else {
        // 2. 스프레드시트의 '관리자 계정 관리' 데이터를 순회하며 일치 계정이 있는지 확인
        var adminData = sheets.admins.getDataRange().getValues();
        if (adminData.length > 1) {
          var headers = adminData[0];
          var nameIdx = headers.indexOf('name');
          var pwIdx = headers.indexOf('password');
          
          if (nameIdx !== -1 && pwIdx !== -1) {
            for (var i = 1; i < adminData.length; i++) {
              var row = adminData[i];
              if (row[nameIdx] === username && row[pwIdx] === passwordHash) {
                isValid = true;
                break;
              }
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', isValid: isValid}))
        .setMimeType(ContentService.MimeType.JSON);
        
    // --- 액션 B: 서버 사이드 관리자 계정 신규 추가 ---
    } else if (action === 'addAdmin') {
      var name = payload.name;
      var password = payload.password; // SHA-256 해시값
      
      var nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
      var newId = new Date().getTime();
      
      // 스프레드시트 '관리자 계정 관리' 시트에 한 줄 추가
      sheets.admins.appendRow([newId, name, password, nowStr]);
      
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
    // --- 액션 D: 관리자 목록 조회 (비밀번호 제외) ---
    } else if (action === 'getAdmins') {
      var adminData = sheets.admins.getDataRange().getValues();
      var admins = [];
      if (adminData.length > 1) {
        var headers = adminData[0];
        var idIdx = headers.indexOf('id');
        var nameIdx = headers.indexOf('name');
        var dateIdx = headers.indexOf('date');
        
        for (var i = 1; i < adminData.length; i++) {
          var row = adminData[i];
          var obj = {
            id: idIdx !== -1 ? Number(row[idIdx]) : '',
            name: nameIdx !== -1 ? row[nameIdx] : '',
            date: dateIdx !== -1 ? row[dateIdx] : ''
          };
          admins.push(obj);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', admins: admins}))
        .setMimeType(ContentService.MimeType.JSON);

    // --- 액션 E: 관리자 계정 삭제 (마스터 계정 삭제 불가 보호) ---
    } else if (action === 'deleteAdmin') {
      var adminId = Number(payload.adminId);
      var adminData = sheets.admins.getDataRange().getValues();
      var deleted = false;
      
      if (adminData.length > 1) {
        var headers = adminData[0];
        var idIdx = headers.indexOf('id');
        var nameIdx = headers.indexOf('name');
        
        if (idIdx !== -1) {
          for (var j = 1; j < adminData.length; j++) {
            var row = adminData[j];
            var currentId = Number(row[idIdx]);
            var currentName = nameIdx !== -1 ? row[nameIdx] : '';
            
            if (currentId === adminId) {
              if (currentName === 'admin') {
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
