---
type: rule
status: active
enforcement: approval-required
scope: apps/desktop secure storage protocol and validation
last-reviewed: 2026-09-15
rationale: 실제 로그인 흐름과 실행 시 보호 검사를 유지하며 광범위한 사전 검증을 배포 차단 조건으로 삼지 않는다.
evidence: "PR #60 사용자 승인: https://github.com/blahaj94/ldb/pull/60#issuecomment-5553807475 ; 설계 근거: Issue #55; main a82547c; Electron 39.8.10 공식 문서"
exceptions: 실제 credential/keychain·protocol registry·패스키 설정과 packaged E2E는 수행하지 않는다.
review-after: 출시 OS 및 package 선택, Electron 변경, 최초 저장·protocol E2E 시
---

# Desktop Authentication Platform

승인 상태·IPC/화면은 [Desktop contract](desktop-auth.md), 상태 전이는 [lifecycle](desktop-auth-lifecycle.md)을 따른다. 이 문서는 OS 동작을 이미 구현·검증했다는 주장이 아니다.

## 확인한 사실과 근거의 한계

2026-09-06 조사 범위는 repository source/config와 공식 문서, host의 OS version·architecture 읽기다. Electron 실행, DB/외부 인증 호출, Keychain/DPAPI/secret store 접근, protocol 등록/변경은 수행하지 않았다.

| 분류 | 확인 내용 | 아직 증명하지 않은 것 |
| --- | --- | --- |
| Source/config | `apps/desktop/package.json` 범위는 Electron `^39.2.6`, `pnpm-lock.yaml` 해결 version은 **39.8.10**, electron-builder **26.15.3** | 설치 runtime 실행·지원 최신성·배포 안전성 |
| Packaging 선언 | `apps/desktop/electron-builder.yml`: Windows/NSIS, macOS/DMG, Linux AppImage/snap/deb 관련 설정 | LDB의 실제 지원 OS/arch 약속, package 생성/설치·인증 성공 |
| Placeholder/미구현 | appId `com.electron.app`, productName `apps-desktop`, Windows model ID `com.electron`, `notarize:false`; protocol 선언·handler·single-instance·safeStorage 없음 | 실제 배포 identity·서명·공증·scheme/host/path가 확정됐다는 근거가 아님 |
| Host 관측 | macOS **26.6.2 / arm64**, `sw_vers -productVersion`, `uname -m` 읽기 | macOS 앱/Keychain 성공, Windows/Linux 실행 성공 |
| Electron 공식 범위 | Pinned README는 macOS 12+ Intel/Apple Silicon, Windows 10+ x86/x64/arm64, Linux Ubuntu 18.04+/Fedora 32+/Debian 10+ 검증 목록을 명시 | Electron 지원 설명은 LDB 최소 OS나 해당 OS의 현재 보안 지원 기간을 확정하지 않음 |

근거: [Electron 39.8.10 README](https://raw.githubusercontent.com/electron/electron/v39.8.10/README.md), [safeStorage](https://raw.githubusercontent.com/electron/electron/v39.8.10/docs/api/safe-storage.md), [app lifecycle/path](https://raw.githubusercontent.com/electron/electron/v39.8.10/docs/api/app.md), [pinned Deep Links guide](https://raw.githubusercontent.com/electron/electron/v39.8.10/docs/tutorial/launch-app-from-url-in-another-app.md). 문서 확인을 실제 LDB E2E 결과로 표시하지 않는다. 출시 전 Electron/OS 지원 상태도 다시 확인하며 version 교체는 별도 변경 범위다.

## Clock과 절전 관측

시간 신뢰 판정과 수치 예산은 [lifecycle의 로컬 clock 신뢰](desktop-auth-lifecycle.md#로컬-clock-신뢰)를 따릅니다. 제품 main은 ready와 단일 인스턴스 ownership 확인 뒤 인증 dependency 생성 전에 `powerMonitor`의 `suspend`와 `resume`을 연결합니다. 취소 가능한 quit 동안 listener를 유지하고, 확정 종료·fatal 초기화 실패 또는 auth runtime을 만들지 않는 fallback에서 해제합니다. Listener는 clock 구간을 무효화하며 credential을 삭제하거나 자동 refresh하지 않습니다.

Node `performance.now()`는 process 기준의 monotonic 값이고 서버 시간이 아닙니다. Wall clock 조정과 두 clock의 drift는 별개로 다뤄야 합니다. Electron의 이벤트 API도 실제 package에서 이벤트가 제때 도착하거나 모든 절전을 포착했다는 증거는 아닙니다. 두 시계가 같은 만큼 이동하고 OS 이벤트도 관측하지 못한 경우를 상대 차이 검사만으로 절전이라고 판별할 수 없습니다. 실제 OS clock을 변경하는 검증은 이번 주입 테스트 범위에 포함하지 않습니다.

절전·시계 조정·장기 drift의 전체 OS/architecture/package 조합 시험은 배포 선행 조건이 아닙니다. 기존 시간 판정과 suspend/resume 처리는 유지하고, 배포 후 실제 사용에서 드러난 재현 사례에 맞춰 검증·수정합니다. 주입 테스트를 실제 OS 관측으로 표시하지 않으며, 1,000 ms 정책 예산을 바꿀 때는 사용자 동작에 미치는 영향을 함께 설명합니다.

## OS 저장 선택

**권장: main 전용 Electron `safeStorage` 암복호화 + app 전용 암호문 file.** 기존 Electron 기능이라 새 native dependency가 필요 없고 선언된 세 OS 계열을 다룰 수 있다. safeStorage 자체는 credential file 저장·atomic replacement·삭제를 제공하지 않는다. 아래 file protocol을 함께 구현해야 한다.

| OS | 공식 보호 경계 | 인증 허용 조건·미확인 |
| --- | --- | --- |
| macOS | Keychain에 app encryption key 보관 | ready 뒤 encryption availability·실제 암복호화 성공 확인. Keychain lock/거절은 실패 처리. 서명·업데이트·다른 bundle 복원은 배포 후 재현 사례에 따라 검증 |
| Windows | DPAPI 기반. 다른 OS user에 대한 보호이며 같은 user의 다른 app 차단을 보장하지 않음 | availability·암복호화 실패 처리. user/profile 이동·업데이트는 배포 후 재현 사례에 따라 검증. OS credential vault의 app 격리로 표현하지 않음 |
| Linux | Backend는 환경에 따라 libsecret/KWallet 등 | availability=true이며 `gnome_libsecret`, `kwallet`, `kwallet5`, `kwallet6` 중 하나만 허용. `basic_text`, `unknown`, 예상 밖 backend는 storageBlocked |

`setUsePlainTextEncryption(true)` 및 평문/renderer storage/access-only fallback은 금지한다. 안전한 backend가 없으면 로그인과 로그인 유지가 불가능하다는 명시적 선택이다. Capture·브라우저 권한 변경으로 저장 문제를 우회하지 않는다.

Pinned safeStorage는 동기 API이며 OS prompt가 main thread를 막을 수 있다. OS 사용자 승인/취소가 필요할 수 있고 JavaScript timer로 prompt를 취소하거나 일정 시간 내 UI 응답을 보장하지 않는다. Credential 접근 전 안내를 표시하고 완료/거절 뒤 상태를 반영한다. JS HTTP deadline은 이 OS prompt의 강제 종료 예산이 아니다.

| 대안 | 비교·판단 |
| --- | --- |
| OS별 credential manager/native library | App-specific UX를 제공할 수 있지만 새 dependency·ABI/packaging·세 OS 구현을 추가한다. 현재 요구를 넘는 app 격리나 OS UX가 필요하면 별도 승인안으로 재검토 |
| Memory-only refresh | Disk 장애 경계는 줄지만 앱 재시작 로그인 유지 요구를 충족하지 못한다. 자동 fallback으로 채택하지 않음 |
| 평문 file/localStorage | OS 보호와 main 소유 경계를 충족하지 못하므로 채택하지 않음 |

## Credential file과 crash 복구

Path는 main이 고정한 `app.getPath('userData')/auth/<environment>/` 아래로 한정한다. `<environment>`는 trusted build 설정의 제한된 값이며 renderer 입력이 아니다. Dev/test/prod는 userData·API origin·protocol identity를 분리한다. 실제 directory/backup·OS ACL 동작은 platform 검증 대상이다.

- `credential.v1`: version, environment/API origin/clientId context, safeStorage ciphertext만 담는 최대 16,384-byte record. 암호화 payload는 동일 context와 canonical refresh token 하나다. Access/user/nickname/pending/verifier/code/launch URL은 저장하지 않는다. Context mismatch/unknown version/key/형식/크기 오류는 복원하지 않는다.
- `transition.v1`: secret 없는 durable marker. Version, local operation ID, 종류(`exchange`, `refresh`, `clear`)만 가진다. Marker가 있으면 credential file의 값은 **어느 version이든 사용 불가**다. Local operation ID는 서버 credential/ID와 별개다.
- File IO는 main 전용이며 directory ownership과 regular file 여부를 확인한다. Symlink/예상 밖 type·권한 오류는 fail closed다. POSIX directory/file 권한은 0700/0600, Windows는 해당 user의 private profile ACL을 검증한다. Temporary file은 동일 directory에서 exclusive 생성하고 같은 제한을 적용한다. Backup/이전 token 사본을 recovery source로 남기지 않는다.

여기서 marker·commit·삭제의 durable 확인은 구현이 요구하는 write, flush, replace, directory sync와 close의 성공을 뜻한다. 물리 정전 후 디스크 상태까지 입증했다는 뜻이 아니며, 이를 입증하기 위한 장애 시험을 로그인이나 배포의 선행 조건으로 요구하지 않는다.

### POSIX profile ancestor permissions

```yaml
status: active
enforcement: approval-required
rationale: 최종 profile이 private이어도 교체 가능한 상위 directory를 통해 profile과 credential 경로가 훼손되는 경계를 보수적으로 제한한다.
evidence: Issue #425, PR #422 review discussion_r3992882587
exceptions: sticky bit를 이용한 group/other write 예외를 두지 않으며, POSIX mode bits로 확장 ACL이나 Windows ACL을 보장하지 않는다.
review-after: Issue #425 구현 PR의 사용자 merge와 POSIX·native profile 검증 후
```

이 절의 substantive contract는 Issue #425 구현 PR의 채택 대상이며 사용자 merge 후부터 active Rule로 적용한다. Merge 전에는 다른 작업의 active Rule로 사용하지 않으며, 이 경계를 위해 별도 승인 대기를 만들지 않는다. POSIX UID를 조회할 수 있는 경우, existing profile ancestor와 final direct parent는 root UID `0` 또는 현재 process UID가 소유하고 `mode & 0o022 === 0`이어야 한다. Final profile directory의 기존 current-UID `0700` 검사와 missing component의 `0700` 생성은 유지한다. 이 조건을 확인하기 전에는 `mkdir`, Electron `setPath`, app name, app identity setter를 시작하지 않는다. POSIX UID를 조회할 수 없는 환경과 Windows는 mode bits로 owner/ACL 안전성을 추정하지 않으며 실행 시 native ACL·reparse-point 검사 결과로 판단한다.

네트워크 transaction과 disk write를 원자적으로 묶을 수 없으므로 **결과 불명 token은 사용하지 않는 marker 방식**을 선택한다. 순서는 다음과 같다.

1. 필요하면 기존 ready refresh를 main memory에 읽는다. Single writer 안에서 marker를 durable 생성/교체하고 성공을 확인한다. 실패하면 exchange/refresh를 보내지 않으며 storageBlocked다. 이미 남은 marker를 무시하고 덮어쓴 token으로 재시도하지 않는다.
2. Exchange/refresh를 1회 전송한다. Refresh R0가 기존 file에 있더라도 marker가 있으므로 crash 후 R0를 다시 보내지 않는다. 네트워크 전 crash도 보수적으로 새 로그인을 요구할 수 있다.
3. 성공 응답을 완전히 검증하고 safeStorage로 R1을 암호화한다. 동일 directory 임시 file write→file flush→atomic replace→해당 platform의 directory durability 확인 순서로 새 credential record를 commit한다. Write/replace 결과 불명은 성공이 아니다.
4. Credential commit과 generation 유효성을 확인한 뒤 marker 삭제와 그 durability까지 확인한다. **이 단계 뒤에만** signedIn 또는 shared refresh 성공을 publish한다. Logout/cancel이 끼어들면 publish하지 않고 clear로 직렬화한다. Marker unlink 뒤 directory flush 실패처럼 삭제 결과가 불명이면 marker가 남았다고 가정하지 않는다. 먼저 marker를 다시 durable 확립해 재복원 금지를 확인한다.
5. 실패/취소는 marker 유지·필요한 재확립을 확인하고 알려진 credential의 서버 logout을 lifecycle 규격대로 최대 1회 시도한다. **재확립도 실패하면** 현재 process는 token을 쓰지 않되 `storageBlocked/LOCAL_CLEAR_UNCONFIRMED`로 전환한다. 이 경우 새 R1 record만 남아 재시작 시 정상 복원될 가능성이 있어 “다음 실행도 로그인되지 않음”을 보장하지 않는다. 서버 204를 확인했어도 local 삭제 완료와 구분하며, 후자가 미확인이면 전체 logout 완료로 표시하지 않는다.
6. Local clear는 marker 확립→credential 및 이 작업 소유 temp file 제거→삭제 durability 확인→marker 제거/durability 순서다. Clean 상태 확인 후 signedOut 또는 새 login을 허용한다. 이 삭제 과정에서도 marker 상태가 불명하면 위 재확립·실패 안내 규칙을 적용한다.

App 시작 시 marker가 있으면 새/옛 credential을 **복호화해서 자동 refresh하지 않는다**. 파일과 owned temporary record를 위 clear 순서로 제거하고 성공하면 signedOut/REAUTH_REQUIRED, 실패하면 storageBlocked다. Marker 없이 정상 credential 하나만 있으면 복원한다. 손상 record는 사용하지 않고 같은 clear/실패 규칙을 따른다. Backend 잠금·일시적 복호화 거절은 credential을 임의 평문 복원하지 않고 storageBlocked로 유지한다. retryAuth에서 접근이 회복되고 record/marker가 정상일 때만 정상 복원을 재개한다.

`LOGIN_EXCHANGE_INVALID`처럼 명시적인 비성공 응답 뒤 pending을 계속 기다릴 때는 secret 없는 marker를 안전하게 clear한 다음 waitingBrowser로 돌아간다. Clear 실패는 storageBlocked다. Pending memory를 file로 이동하거나 같은 code를 자동 재전송하지 않는다.

아래 복구 동작은 다음 실행에서 관측되는 marker와 파일 상태를 기준으로 한다. 정전이나 저장 장치의 손실로 marker 자체가 사라진 경우까지 복원 금지를 보장하지 않는다.

| Crash/failure 지점 | 다음 실행의 선택 |
| --- | --- |
| Marker 확립 전 | 새 exchange/refresh 전송 없음. 기존 ready R0는 여전히 current일 수 있으며 정상 복원 대상 |
| Marker 확립 후, 전송 전/후/응답 유실 | File의 R0를 무시하고 local clear 후 새 로그인. 서버 폐기 완료를 추정하지 않음 |
| R1 임시 write/replace/flush 중 | Marker가 남아 있으므로 R0/R1 둘 다 사용하지 않음. Temp나 이전 file을 복구 후보로 탐색하지 않음 |
| R1 durable commit 후 marker 제거 전 | 보수적으로 R1도 버리고 새 로그인. 일부 정상 session을 포기하는 가용성 비용을 수용 |
| Marker unlink 뒤 durability 실패, 재확립 결과 | Durable 재확립 성공이면 R1도 복원 0. 재확립 실패면 R1만 남을 수 있어 다음 실행의 자동 복원 차단은 미확인; LOCAL_CLEAR_UNCONFIRMED 안내. R0는 앞서 R1 durable commit으로 교체됐어야 함 |
| Marker 제거 durability 확인 후 | R1만 정상 복원 대상. R0 사본은 없음 |
| Logout에서 marker 확립/credential 삭제조차 실패 | 현재 process는 사용을 중단하지만 재시작 시 이전 record가 남을 가능성을 배제하지 못함. storageBlocked/LOCAL_CLEAR_UNCONFIRMED로 안내하며 영구 logout 성공을 표시하지 않음 |

Atomic replacement·flush·directory sync는 구현대로 수행하고 실제 실패나 불명확한 결과를 성공으로 바꾸지 않는다. 추가 VM 강제 종료 반복, 물리 정전 내구성 입증, 다른 OS·CPU의 전체 조합 검증은 개발·로그인 활성화·배포의 선행 조건에서 제외한다. 기능을 배포한 뒤 실제 사용과 재현된 문제에 따라 필요한 검증과 수정을 수행한다. 기존 장애 실험은 선택적인 진단 도구이며 과거 실패·미검증 결과를 삭제하거나 성공으로 바꾸지 않는다. Disk rollback/OS profile backup 복원·동일 OS user malware와 물리 정전 내구성을 이 marker가 보장하지 않는다. 서버 reuse 탐지와 OS별 한계를 유지하며, 평문 저장이나 이전 token fallback을 추가하지 않는다.

### Windows profile ACL과 namespace 경계

Windows profile과 credential의 현재 사용자는 process token의 user SID로 판정한다. 이름 조회나 group membership으로 user SID를 대체하지 않는다. 열린 handle에서 reparse point와 directory/file type을 확인하고, null DACL·empty DACL·unknown/object/callback ACE·지원하지 않는 ACE flags/size는 거절한다.

최종 profile과 credential file은 현재 SID owner와 현재 SID 하나에 full control을 부여한 private DACL만 허용한다. 기존 상위 폴더는 현재 SID 외에 Windows `LocalSystem`(`S-1-5-18`), 기본 `Administrators`(`S-1-5-32-544`), Windows Modules Installer의 `TrustedInstaller` service SID(`S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464`)를 owner 및 관리 principal로 허용한다. 앞의 두 OS SID는 `IsWellKnownSid`로, service SID는 검증한 SID의 고정 식별자 전체로 비교하며 임의 관리자 계정·다른 group·이름을 허용 목록에 넣지 않는다. OS 및 로컬 관리자의 권한은 이 격리 경계 밖에 있고, 일반 다른 사용자의 profile 교체를 방어한다. 기존 OS 폴더의 owner·ACL은 수정하지 않는다.

상위 폴더에서 나머지 principal의 effective allow ACE가 namespace 위험 mask(`DELETE`, `FILE_DELETE_CHILD`, `WRITE_DAC`, `WRITE_OWNER` 및 generic write/all)를 포함하면 거절한다. Deny ACE로 위험 allow를 상쇄했다고 추론하지 않는다. `INHERIT_ONLY_ACE`는 현재 객체에 접근 권한을 주지 않으므로 구조·SID를 검증한 뒤 현재 폴더의 위험 판정에서는 제외한다. 경로상의 실제 자식은 각각 다시 검사하여 effective inherited ACE의 위험 권한을 거절한다. 새 private 폴더와 파일의 상속 차단은 유지한다.

Volume root는 상위 directory entry가 없으므로 `DELETE` 자체와 그 아래 자식을 지우는 `FILE_DELETE_CHILD`를 구분한다. Root 예외는 검사 중인 동일 handle의 `GetFinalPathNameByHandleW(FILE_NAME_NORMALIZED | VOLUME_NAME_GUID)` 결과가 자식 경로 없는 volume GUID root일 때만 적용하며 `DELETE` 하나만 위험 mask에서 제외한다. `FILE_DELETE_CHILD`, ACL·owner 변경과 generic write/all 검사는 유지한다. 드라이브 문자만으로 root를 신뢰하지 않으며 SUBST 하위 폴더·network share·reparse point·조회 실패·잘린 결과에는 예외를 적용하지 않는다. Profile 검사·부모 재검사·sync 모두 같은 root/ancestor/private 구분을 사용한다.

상위 폴더와 최종 profile의 실제 권한 검사는 로그인 준비에서 유지한다. 과거 시험의 완료 여부를 대신 나타내는 고정 capability 값은 사용하지 않는다.

Missing directory는 current SID를 명시한 private security descriptor와 `bInheritHandle=false`인 security attributes로 생성한다. Credential temp file은 같은 directory에서 `CREATE_NEW`와 `FILE_FLAG_WRITE_THROUGH`로 만들고, `WriteFile`·`FlushFileBuffers` 후 같은 handle의 `SetFileInformationByHandle(FileRenameInfo)`로 교체한 뒤 같은 handle flush를 수행한다. 삭제도 검증한 handle에 `FileDispositionInfo`를 적용한다. `FlushFileBuffers`의 directory 호출이나 delete/namespace 성공은 일반 filesystem과 power-loss durability의 증거로 간주하지 않는다.

Windows profile 준비와 credential 저장은 Koffi/Win32의 실제 호출 결과를 사용한다. `profileProtection`, `fileMutation`, `namespaceMutation`을 `unknown`으로 고정해 모든 실행을 거절하던 release capability는 제거한다. 검증되지 않은 보장을 `confirmed`로 표시하는 설정이나 개발용 우회 flag로 대체하지 않는다. Native 모듈 로드, SID/ACL·reparse 검사 또는 필요한 파일 작업이 실패하면 기존 `preparation-failed` 또는 `storageBlocked` 처리를 유지한다. 배포할 설치 파일에서 native 모듈과 실제 로그인 흐름을 확인하되, 전체 OS/CPU의 ABI·권한·전원 손실 시험을 통과해야 배포할 수 있다는 조건은 두지 않는다.

## Protocol 및 browser launch 선택

**흐름: 격리 HTTPS 인증 창의 직접 패스키 또는 휴대폰 QR 승인 → 완료 화면의 앱 복귀 버튼 → main.** 전용 창에서는 callback navigation을 차단하고 기존 교환 함수에 전달한다. 외부에서 도착하는 기존 OS protocol 복귀도 같은 검증을 유지한다. 고정된 returnUrl과 code-only 흐름으로 별도 listener 없이 앱을 활성화한다. 정확한 scheme/host/path는 owned namespace와 배포 identity를 확인한 후 서버 설정와 packaged 앱에 동일하게 등록한다. 현재 placeholder나 임의 `ldb://...`를 실제 등록값으로 간주하지 않는다.

Private protocol은 같은 OS user의 다른 앱이 가로챌 수 있다. Pending request + S256 verifier가 없는 앱은 자체 code를 교환할 수 없지만 가용성 방해·정품 앱 보증 문제를 모두 해결하지 않는다. Public clientId도 설치 인증이 아니다. 이 선택은 브라우저 인증 이후 별도 code 복귀라는 프로젝트 선택이며 모든 OS의 최선이라는 주장이 아니다.

Claimed HTTPS는 domain association·OS별 배포 검증을 추가하고, loopback은 listener/port/lifecycle과 현재 복귀 설정 형태에 대한 별도 결정을 요구한다. 실제 private protocol을 안정적으로 등록할 수 없는 배포를 선택한다면 해당 대안과 서버 설정 영향부터 별도 승인받는다. 임의 loopback redirect나 manual token/code 붙여넣기를 fallback으로 추가하지 않는다.

### 로컬 개발용 등록값

사용자가 선택한 `ldb.dev://auth/callback`은 로컬 개발용 복귀 주소이며 placeholder가 아니다. [PR #455](https://github.com/blahaj94/ldb/pull/455)는 이 선택에 맞춘 아래 개발 tuple과 적용 범위를 채택 대상으로 포함한다. 사용자 merge 후 활성화하며 운영 배포의 namespace·identity·서명 선택이나 다른 작업의 미결정 gate를 대신하지 않는다.

| 항목 | 로컬 개발 구성 |
| --- | --- |
| 환경·대상 | `development`, 사용자가 지정한 Windows 개발 컴퓨터의 현재 사용자, x64 NSIS |
| API·인증 | 같은 컴퓨터의 `https://localhost:3443`, 패스키 |
| RP ID | `localhost` |
| 앱 복귀 | `ldb.dev://auth/callback` |
| 개발 앱 identity·profile | `ldb.dev`, Electron `appData` 아래의 `ldb.dev` |

이 선택은 개발 환경에서 사용할 이름을 정한 것이며 `ldb.dev` 인터넷 도메인의 소유권이나 OS protocol의 전역 독점권을 주장하지 않는다. 해당 사용자 환경에서 LDB 개발 앱에 할당할 수 있는지 설치 전에 확인한다. 실제 설치·등록은 실행 허용 범위 안에서 서버 설정의 API·RP ID·returnUrl 일치와 기존 사용자·컴퓨터 protocol association 충돌 여부를 확인한 뒤 수행한다. 다른 앱의 등록이 있거나 소유권이 불분명하면 덮어쓰지 않고 그 설치를 보류한다. 과거 충돌 부재를 다음 설치·업데이트의 근거로 대신하지 않는다.

빌드·NSIS 파일 생성은 설치나 등록 실행이 아니다. 이 개발 구성은 운영 installer나 다른 OS package의 기본값으로 사용하지 않는다. 이후 다른 앱이 protocol을 가로채는 위험과 PKCE의 보호 한계, 설치 후 실제 handler·cold/warm 복귀 검증 의무는 위 공통 계약대로 유지한다. 이 등록값 선택이 실제 패스키 로그인 성공을 뜻하지는 않는다. Windows 저장은 위 실행 시 검사와 실패 처리를 따른다.

### Windows MVP 배포 구성

Windows x64 NSIS 배포 앱은 이름 `LDB`, executable `ldb.exe`, app identity 및 `appData` 아래 profile `ldb`, 인증 환경 `production`, 복귀 주소 `ldb://auth/callback`을 사용한다. 이 선택은 배포 설정 PR의 채택 범위이며 사용자 merge 후 다른 작업에 적용한다. 인터넷 도메인 소유권이나 protocol의 전역 독점권을 주장하지 않는다.

배포 API는 빌드 시 지정한 canonical HTTPS origin을 main bundle에 포함하며 localhost 개발 origin을 배포 기본값으로 사용하지 않는다. RP ID는 해당 origin의 hostname이며 서버 설정의 복귀 주소는 `ldb://auth/callback`과 일치해야 한다. 공개 설정만 포함하고 서버 secret·credential은 설치 파일에 넣지 않는다. 실제 서버·HTTPS 연결·패스키 설정의 준비와 성공을 이 namespace 선택으로 대신하지 않는다.

개발 앱의 `ldb.dev`·profile·설치 경로는 보존한다. 배포 앱은 별도 `ldb` 설치 폴더를 사용하며, 기존 NSIS 소유권 검사와 자기 protocol 등록만 제거하는 정책을 재사용한다. 자동 업데이트·추가 OS는 이번 배포 완료 조건에 포함하지 않는다. 실행 명령과 짧은 사용 안내는 [Desktop README](../../apps/desktop/README.md)를 따른다.

### 공통 진입점

| 진입점 | 등록·처리 계약 | 실제 사용에서 확인할 사항 |
| --- | --- | --- |
| macOS | main entry에서 ready 이전 `open-url` listener 등록 및 preventDefault. Bundle `CFBundleURLTypes`에 승인 target의 scheme 선언. OS event를 단일 validator로 전달 | Packaged/installed cold·warm·창 없음, 서명/업데이트, 여러 bundle의 association 충돌 |
| Windows/Linux | Packaged executable 또는 Electron `defaultApp`의 executable·app path를 제거한 user argv를 검사한다. Lock loser가 bounded/versioned `additionalData`로 같은 user argv를 보내며 owner는 이를 재검증하고 mutable `second-instance` command line을 인증 판정에 쓰지 않는다. Single-instance loser는 store/network 작업 없이 종료 | Install 경로 공백, URI 전달·중복, 실제 default handler와 OS별 focus |
| 공통 | Bootstrap에서 event handler와 single-instance ownership을 준비한 뒤 ready·store·window를 초기화. 초기 후보는 raw 2,048 byte 이하 1개만 일시 보유하고 추가 후보는 버림 | Cold start는 pending verifier가 없어 교환하지 않음. 정상 저장 session 복원과 독립적으로 안내 |

Single-instance의 범위는 동일 app profile이며 서로 다른 dev/prod app은 별도 identity를 쓴다. macOS에서 창만 닫아 main이 살아 있으면 pending은 유지하고 유효 복귀 때 창을 다시 만든다. Windows/Linux의 마지막 창 닫힘은 현재 lifecycle상 main quit이므로 pending은 소실된다. Packaged 앱은 URL을 처리하기 위해 창에 URL을 load하지 않고 local renderer만 생성·restore·focus한다. Foreground 전환은 OS가 제한할 수 있어 상태 완료와 focus 성공을 구분한다.

### 입력 검증

- Browser launch URL은 string·2,048 byte 이하이며 exact trusted API HTTPS origin, `/auth/login/authorize` path, **ticket 하나**의 canonical 32-byte base64url query만 허용한다. Username/password·fragment·추가 query·path/port alias·redirect를 허용하지 않는다. URL parser 뒤 canonical 재구성한 값과 원문이 동일해야 하며 allowlist prefix 비교로 대체하지 않는다.
- App 복귀 후보는 bootstrap argument를 제거한 초기 user argv 또는 exact version·shape·count·UTF-8 byte 경계를 다시 확인한 lock handoff의 모든 문자열에서 검사한다. `second-instance` command line의 순서·내용을 인증 입력으로 신뢰하거나 마지막 argument라고 가정하거나 joined command line을 shell로 재해석하거나 arbitrary command를 실행하지 않는다. 한 OS event에 복귀 후보가 2개 이상이면 전체 거절한다. 제거된 executable/app path와 단독 `--` 등 일반 argument를 URL로 취급하지 않는다. `--` 또는 slash prefix option의 첫 `=`나 `:` 뒤 payload는 option 이름의 punctuation·빈 이름과 무관하게 URL-like 분류 대상으로 검사한다. Slash prefix 이름에 path separator가 있으면 POSIX path로 유지한다. 예외는 대소문자를 정규화한 option 이름이 정확히 `user-data-dir`이고 raw argument·payload에 trim/control projection이 없으며, payload가 drive letter와 colon 뒤에 slash 또는 backslash가 정확히 하나인 absolute Windows drive 형태(`C:/...`, `C:\...`)일 때뿐이다. Well-formed scheme 또는 path/query/fragment 구분자 없는 prefix 뒤의 colon과 slash/backslash로 시작하는 형태는 protocol-like이다. Direct drive-shaped user argument와 다른 option의 drive-shaped payload, control 제거 뒤에만 drive path가 되는 값처럼 one-letter URI와 구별할 수 없는 입력은 fail closed한다.
- 복귀 URL도 2,048 byte 이하·control/공백/backslash 없음·정확한 등록 scheme/host/path여야 한다. Userinfo/port/fragment·추가 path·encoded 구분자·dot segment·unknown/duplicate query key를 거절한다. Canonical raw 값은 `<registered-return-target>?code=<canonical-code>`와 정확히 같아야 한다. 대상 target의 authority 유무까지 등록 형태를 따른다.
- Code는 auth-passkeys의 **43자 canonical unpadded base64url, decode 32byte, re-encode 동일**만 허용한다. Code를 URL decode 반복/coercion/trim으로 보정하지 않는다. 입력 code만으로 request/provider/user를 선택하지 않는다.
- URL을 network로 따라가거나 renderer로 전달하지 않는다. Validation 실패·잘못된 scheme은 기존 pending/session·window navigation에 side effect가 없다. 정상 URL도 현재 pending이 없으면 교환 0이다. 동일 code의 중복·expired handling은 lifecycle을 따른다.

### Linux package별 동작 참고

- deb: 설치된 `.desktop`, `MimeType=x-scheme-handler/...`, `Exec`의 URI 전달, default association·업데이트·제거를 검증한다. [electron-builder v26 Linux](https://www.electron.build/v26/docs/linux/)
- AppImage: electron-builder 21 이후 self desktop integration이 없으므로 AppImage 실행 성공은 browser 복귀 보장이 아니다. Desktop integration 배포 방법을 먼저 선택한다. [AppImage 안내](https://www.electron.build/v26/docs/appimage/#desktop-integration)
- snap: installed desktop entry·URI 전달, confinement·secret store 접근을 따로 확인한다. `password-manager-service` 자동 연결을 가정하지 않으며 추가 interface 채택은 배포 결정이다. [desktop interface](https://snapcraft.io/docs/reference/interfaces/desktop-interface/), [password-manager-service](https://snapcraft.io/docs/reference/interfaces/password-manager-service-interface/)

## 기능 완료와 배포 후 검증

기능 완료는 선택한 배포 환경에서 사용자가 로그인 시작 → 패스키 인증 → 앱 복귀 → 로그인 상태 반영 → 인증 필요 기능 사용을 수행할 수 있는지로 판단한다. 취소·실패 후 재시도와 정상 종료 후 재실행은 기존 lifecycle 계약을 따른다. 가능한 환경에서 이 흐름을 직접 확인하고, 실제 credential이나 환경 권한이 없으면 구현을 먼저 완성한 뒤 미검증 경로와 필요한 다음 실행을 명시한다. Mock 성공을 실제 로그인 성공으로 바꾸지 않는다.

변경 영향에 맞는 기존 unit·통합 검증과 선택한 설치 앱의 기본 동작 확인을 수행한다. 모든 변경에 전체 Desktop test/lint/build나 모든 OS·인증기·package 조합 시험을 일괄 요구하지 않는다. 실제 필요한 검사는 [Testing](testing.md)을 따른다. Credential의 main 소유, PKCE와 callback/IPC 입력 검증, 암호화, 파일 권한·실패 처리, 취소 후 늦은 응답 차단은 계속 유지한다.

VM 강제 종료의 지점별 반복, 물리 정전, 장기 clock drift, profile 이동·backup 복원, 다른 OS·CPU·package 및 서명/업데이트 조합의 광범위한 시험 목록은 배포 gate로 관리하지 않는다. 배포 후 사용자 피드백과 재현 사례를 바탕으로 필요한 항목만 확인하고 수정한다. 이미 발견한 중요한 결함을 숨기거나 다른 환경에서의 성공을 해당 환경의 성공으로 표시하지 않는다. 장애 주입 도구의 VM 전원·복원 등 파괴적 실행은 그때 필요한 별도 허용 범위를 따른다.

## 배포 구성과 실행 조건

배포 대상과 실제 사용한 OS·architecture·package, API HTTPS origin, RP ID, 앱 return target과 identity를 구분해 기록한다. 선택하지 않은 플랫폼 검증이나 서명/업데이트 시험이 현재 대상의 로그인 구현을 막지 않는다. 설치 파일에 필요한 native 모듈이 포함되고 등록값이 서버와 앱에서 일치해야 하며, 다른 앱의 protocol 등록을 덮어쓰지 않는다. 로컬 개발은 위 개발 tuple을 사용하고 운영 등록값을 placeholder로 추정하지 않는다.

패스키·QR 지원은 현재 구현과 실제 브라우저·기기 연결 결과로 판단한다. 선택하지 않은 기기의 미완료 검증을 현재 환경의 성공으로 확대하지 않는다. 실제 credential·패스키 설정·운영 DB·배포 실행 권한은 검증 절차 제거만으로 새로 생기지 않는다. 후속 작업과 PR은 [개발 흐름](agent-workflow.md)을 따르며 사용자만 merge한다.
