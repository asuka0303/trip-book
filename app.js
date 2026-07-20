// このファイルは、グループIDと合言葉でログインして旅行データを扱います。
// 旅行、行き先、資料はグループ単位で分離されます。

const showTripFormButton = document.getElementById("showTripFormButton");
const tripFormSection = document.getElementById("tripFormSection");
const cancelTripFormButton = document.getElementById("cancelTripFormButton");
const saveTripButton = document.getElementById("saveTripButton");
const tripFormMessage = document.getElementById("tripFormMessage");
const tripListMessage = document.getElementById("tripListMessage");
const tripList = document.getElementById("tripList");

const tripTitleInput = document.getElementById("tripTitle");
const tripDestinationInput = document.getElementById("tripDestination");
const tripStartDateInput = document.getElementById("tripStartDate");
const tripEndDateInput = document.getElementById("tripEndDate");
const tripMeetingPlaceInput = document.getElementById("tripMeetingPlace");
const tripMeetingTimeInput = document.getElementById("tripMeetingTime");
const tripImportantNoteInput = document.getElementById("tripImportantNote");

const tripDetailEmpty = document.getElementById("tripDetailEmpty");
const tripDetailSection = document.getElementById("tripDetailSection");
const detailTitle = document.getElementById("detailTitle");
const detailDestination = document.getElementById("detailDestination");
const detailStartDate = document.getElementById("detailStartDate");
const detailEndDate = document.getElementById("detailEndDate");
const detailMeetingPlace = document.getElementById("detailMeetingPlace");
const detailMeetingTime = document.getElementById("detailMeetingTime");
const detailImportantNote = document.getElementById("detailImportantNote");
const tabContent = document.getElementById("tabContent");
const tabButtons = Array.from(document.querySelectorAll('[role="tablist"][aria-label="旅行の情報タブ"] .tab-button'));

const groupAuthSection = document.getElementById("groupAuthSection");
const authTabCreate = document.getElementById("authTabCreate");
const authTabJoin = document.getElementById("authTabJoin");
const authCreatePanel = document.getElementById("authCreatePanel");
const authJoinPanel = document.getElementById("authJoinPanel");
const groupNameInput = document.getElementById("createGroupName");
const groupPasswordCreateInput = document.getElementById("createGroupSecret");
const createGroupButton = document.getElementById("createGroupButton");
const createGroupMessage = document.getElementById("createGroupMessage");
const groupIdInput = document.getElementById("joinGroupId");
const groupPasswordJoinInput = document.getElementById("joinGroupSecret");
const joinGroupButton = document.getElementById("joinGroupButton");
const joinGroupMessage = document.getElementById("joinGroupMessage");
const groupSessionBar = document.getElementById("groupSessionBar");
const appSection = document.getElementById("appSection");
const groupSessionInfo = document.getElementById("groupSessionInfo");
const logoutButton = document.getElementById("logoutButton");

const imagePreviewModal = document.getElementById("imagePreviewModal");
const imagePreview = document.getElementById("imagePreview");
const closeImageModalButton = document.getElementById("closeImageModalButton");

let supabaseClient = null;
let bootstrapClient = null;
let supabaseProjectUrl = "";
let supabasePublishableKey = "";
const documentImageBucketName = typeof SUPABASE_STORAGE_BUCKET === "string" && SUPABASE_STORAGE_BUCKET
  ? SUPABASE_STORAGE_BUCKET
  : "trip-book-documents";
let trips = [];
let selectedTripId = null;
let activeTab = "places";
let currentGroupId = "";
let currentGroupName = "";
let currentGroupSecret = "";

let places = [];
let placeLoadedTripId = null;
let placeLoadToken = 0;
let selectedPlaceId = null;
let placeFormMode = "create";
let placeFormOpen = false;
let placeListStatus = "";
let placeFormStatus = "";
let isPlaceLoading = false;
let isPlaceProcessing = false;

let documents = [];
let documentLoadedTripId = null;
let documentLoadToken = 0;
let selectedDocumentId = null;
let documentFormMode = "create";
let documentFormOpen = false;
let documentListStatus = "";
let documentFormStatus = "";
let isDocumentLoading = false;
let isDocumentProcessing = false;
let currentImagePreviewUrl = "";
let currentImagePreviewTitle = "";
let documentDraftImageFile = null;
let documentDraftImageUrl = "";
let documentDraftImageName = "";
let documentDraftRemoveImage = false;

function showMessage(element, message) {
  element.textContent = message;
}

function normalizeInput(value) {
  return value.trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatText(value) {
  const trimmedValue = normalizeInput(String(value || ""));
  return trimmedValue || "-";
}

function formatDate(value) {
  return value || "-";
}

function formatTime(value) {
  return value || "-";
}

function createUniqueId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createGroupId() {
  const randomPart = Math.random().toString(16).slice(2, 10);
  return `grp-${randomPart}`;
}

function getSessionStorageKey() {
  return "tripBookGroupSession";
}

function saveGroupSession() {
  const payload = {
    groupId: currentGroupId,
    groupName: currentGroupName,
    groupSecret: currentGroupSecret,
  };

  localStorage.setItem(getSessionStorageKey(), JSON.stringify(payload));
}

function clearGroupSession() {
  localStorage.removeItem(getSessionStorageKey());
}

function restoreGroupSession() {
  try {
    const raw = localStorage.getItem(getSessionStorageKey());

    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw);

    if (!parsed?.groupId || !parsed?.groupSecret) {
      return false;
    }

    currentGroupId = String(parsed.groupId);
    currentGroupName = String(parsed.groupName || "");
    currentGroupSecret = String(parsed.groupSecret);
    return true;
  } catch {
    return false;
  }
}

function createAuthedSupabaseClient(projectUrl, publishableKey) {
  return window.supabase.createClient(projectUrl, publishableKey, {
    global: {
      headers: {
        "x-group-id": currentGroupId,
        "x-group-secret": currentGroupSecret,
      },
    },
  });
}

function setAppLockedState(isLocked) {
  groupAuthSection.classList.toggle("hidden", !isLocked);
  appSection.classList.toggle("hidden", isLocked);
  tripDetailEmpty.classList.toggle("hidden", isLocked);
  groupSessionBar.classList.toggle("hidden", isLocked);

  if (!isLocked) {
    const name = currentGroupName || "未設定";
    if (groupSessionInfo) {
      groupSessionInfo.innerHTML = `
        <span class="group-session-label">利用中グループ:</span>
        <span class="group-session-name">${escapeHtml(name)}</span>
        <span class="group-session-id-badge">ID</span>
        <span class="group-session-id">${escapeHtml(currentGroupId)}</span>
      `;
    }
    return;
  }

  if (groupSessionInfo) {
    groupSessionInfo.textContent = "";
  }
}

function handleLogout() {
  clearGroupSession();
  supabaseClient = null;
  trips = [];
  selectedTripId = null;
  activeTab = "places";
  currentGroupId = "";
  currentGroupName = "";
  currentGroupSecret = "";
  resetDetailState();
  closeTripForm();
  tripList.innerHTML = "";
  showMessage(tripListMessage, "");
  setAuthTab("create");
  setAppLockedState(true);
}

function setAuthTab(tab) {
  const isCreate = tab === "create";
  authTabCreate.classList.toggle("active", isCreate);
  authTabJoin.classList.toggle("active", !isCreate);
  authCreatePanel.classList.toggle("hidden", !isCreate);
  authJoinPanel.classList.toggle("hidden", isCreate);
}

function resetAuthMessages() {
  showMessage(createGroupMessage, "");
  showMessage(joinGroupMessage, "");
}

function getTripFormValues() {
  return {
    title: normalizeInput(tripTitleInput.value),
    destination: normalizeInput(tripDestinationInput.value),
    start_date: tripStartDateInput.value,
    end_date: tripEndDateInput.value,
    meeting_place: normalizeInput(tripMeetingPlaceInput.value),
    meeting_time: tripMeetingTimeInput.value,
    important_note: normalizeInput(tripImportantNoteInput.value),
  };
}

function getSelectedTrip() {
  return trips.find((trip) => String(trip.id) === String(selectedTripId)) || null;
}

function getSelectedPlace() {
  return places.find((place) => String(place.id) === String(selectedPlaceId)) || null;
}

function getSelectedDocument() {
  return documents.find((document) => String(document.id) === String(selectedDocumentId)) || null;
}

function resetTripForm() {
  tripTitleInput.value = "";
  tripDestinationInput.value = "";
  tripStartDateInput.value = "";
  tripEndDateInput.value = "";
  tripMeetingPlaceInput.value = "";
  tripMeetingTimeInput.value = "";
  tripImportantNoteInput.value = "";
  showMessage(tripFormMessage, "");
}

function openTripForm() {
  tripFormSection.classList.remove("hidden");
  tripTitleInput.focus();
}

function closeTripForm() {
  tripFormSection.classList.add("hidden");
  resetTripForm();
}

function resetPlaceState() {
  places = [];
  placeLoadedTripId = null;
  placeLoadToken += 1;
  selectedPlaceId = null;
  placeFormMode = "create";
  placeFormOpen = false;
  placeListStatus = "";
  placeFormStatus = "";
  isPlaceLoading = false;
  isPlaceProcessing = false;
}

function resetDocumentState() {
  documents = [];
  documentLoadedTripId = null;
  documentLoadToken += 1;
  selectedDocumentId = null;
  documentFormMode = "create";
  documentFormOpen = false;
  documentListStatus = "";
  documentFormStatus = "";
  isDocumentLoading = false;
  isDocumentProcessing = false;
  resetDocumentDraftState();
}

function resetDetailState() {
  resetPlaceState();
  resetDocumentState();
}

function createFriendlyCrudError(entityName, error) {
  const message = error?.message || "";

  if (message.includes("row-level security")) {
    return `${entityName}の見せるルールで止まりました。Supabaseのポリシーを確認してください。`;
  }

  if (message.includes("permission denied")) {
    return `${entityName}を使う許可が足りません。Supabaseの設定を確認してください。`;
  }

  return `${entityName}の保存や読み込みでエラーが出ました。もう一度試してください。`;
}

function openExternalUrl(url) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function openImageModal(url, title) {
  if (!url) {
    return;
  }

  currentImagePreviewUrl = url;
  currentImagePreviewTitle = title || "画像";
  imagePreview.src = currentImagePreviewUrl;
  imagePreview.alt = currentImagePreviewTitle;
  imagePreviewModal.classList.remove("hidden");
  imagePreviewModal.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  imagePreviewModal.classList.add("hidden");
  imagePreviewModal.setAttribute("aria-hidden", "true");
  imagePreview.src = "";
  currentImagePreviewUrl = "";
  currentImagePreviewTitle = "";
}

function revokeDocumentDraftUrl() {
  if (documentDraftImageUrl && documentDraftImageUrl.startsWith("blob:")) {
    URL.revokeObjectURL(documentDraftImageUrl);
  }
}

function resetDocumentDraftState() {
  revokeDocumentDraftUrl();
  documentDraftImageFile = null;
  documentDraftImageUrl = "";
  documentDraftImageName = "";
  documentDraftRemoveImage = false;
}

function getDocumentStorageReference(path) {
  return `storage:${documentImageBucketName}/${path}`;
}

function parseDocumentStorageReference(value) {
  if (!value || typeof value !== "string" || !value.startsWith("storage:")) {
    return null;
  }

  const reference = value.slice("storage:".length);
  const slashIndex = reference.indexOf("/");

  if (slashIndex === -1) {
    return null;
  }

  const bucket = reference.slice(0, slashIndex);
  const path = reference.slice(slashIndex + 1);

  if (!bucket || !path) {
    return null;
  }

  return { bucket, path };
}

function resolveDocumentPreviewUrl(imageUrl) {
  const storageReference = parseDocumentStorageReference(imageUrl);

  if (!storageReference) {
    return imageUrl || "";
  }

  const { data } = supabaseClient.storage.from(storageReference.bucket).getPublicUrl(storageReference.path);
  return data?.publicUrl || "";
}

function getActiveDocumentPreviewUrl(documentItem = null) {
  if (documentDraftRemoveImage) {
    return "";
  }

  if (documentDraftImageUrl) {
    return documentDraftImageUrl;
  }

  return documentItem?.preview_url || "";
}

function getActiveDocumentImageName(documentItem = null) {
  if (documentDraftImageName) {
    return documentDraftImageName;
  }

  if (!documentDraftRemoveImage && documentItem?.preview_url) {
    return "現在の画像";
  }

  return "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("file read failed"));
    };

    reader.onerror = () => reject(reader.error || new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = src;
  });
}

async function buildDocumentImageDataUrl(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);

  if (!file.type.startsWith("image/")) {
    throw new Error("invalid image type");
  }

  if (file.size <= 900 * 1024) {
    return sourceDataUrl;
  }

  const image = await loadImageElement(sourceDataUrl);
  const maxSize = 1600;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const outputQuality = outputType === "image/png" ? undefined : 0.82;
  const optimizedDataUrl = canvas.toDataURL(outputType, outputQuality);

  if (optimizedDataUrl.length >= sourceDataUrl.length) {
    return sourceDataUrl;
  }

  return optimizedDataUrl;
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function getImageExtension(file) {
  const name = String(file?.name || "");
  const parts = name.split(".");
  const explicitExtension = parts.length > 1 ? parts.pop().toLowerCase() : "";

  if (explicitExtension) {
    return explicitExtension;
  }

  if (file?.type === "image/png") {
    return "png";
  }

  if (file?.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

async function uploadDocumentImage(tripId, file) {
  const optimizedDataUrl = await buildDocumentImageDataUrl(file);
  const blob = dataUrlToBlob(optimizedDataUrl);
  const extension = getImageExtension(file);
  const path = `${currentGroupId}/${tripId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  const { error } = await supabaseClient.storage.from(documentImageBucketName).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: blob.type || file.type || "image/jpeg",
  });

  if (error) {
    throw error;
  }

  return getDocumentStorageReference(path);
}

async function deleteStoredDocumentImage(imageUrl) {
  const storageReference = parseDocumentStorageReference(imageUrl);

  if (!storageReference) {
    return;
  }

  const { error } = await supabaseClient.storage.from(storageReference.bucket).remove([storageReference.path]);

  if (error) {
    throw error;
  }
}

function createFriendlyStorageError(error) {
  const message = String(error?.message || "");

  if (message.includes("Bucket not found")) {
    return `Supabase Storage の ${documentImageBucketName} バケットが見つかりません。バケットを作成してください。`;
  }

  if (message.includes("row-level security") || message.includes("permission denied") || message.includes("Unauthorized")) {
    return "画像アップロードの権限がありません。Supabase Storage のポリシーを確認してください。";
  }

  return "";
}

async function handleDocumentImageSelection(file) {
  if (!file) {
    resetDocumentDraftState();
    if (activeTab === "documents") {
      renderDocumentsTab();
    }
    return;
  }

  if (!file.type.startsWith("image/")) {
    setDocumentFormStatus("画像ファイルを選んでください。");
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    setDocumentFormStatus("画像は8MB以下にしてください。");
    return;
  }

  try {
    setDocumentFormStatus("画像を準備中");
    revokeDocumentDraftUrl();
    documentDraftImageFile = file;
    documentDraftImageUrl = URL.createObjectURL(file);
    documentDraftImageName = file.name;
    documentDraftRemoveImage = false;
    setDocumentFormStatus("");
  } catch {
    setDocumentFormStatus("画像の読み込みに失敗しました。別の画像で試してください。");
  }
}

function renderTripList() {
  tripList.innerHTML = "";

  if (trips.length === 0) {
    showMessage(tripListMessage, "まだ旅行が登録されていません");
    return;
  }

  showMessage(tripListMessage, "");

  trips.forEach((trip) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trip-card";
    if (String(trip.id) === String(selectedTripId)) {
      button.classList.add("active");
    }

    button.innerHTML = `
      <h4>${escapeHtml(trip.title || "-")}</h4>
      <p>行き先: ${escapeHtml(trip.destination || "-")}</p>
      <p>開始日: ${formatDate(trip.start_date)}</p>
      <p>終了日: ${formatDate(trip.end_date)}</p>
    `;

    button.addEventListener("click", () => {
      activeTab = "places";
      showTripDetail(trip);
    });

    tripList.appendChild(button);
  });
}

function showTripDetail(trip) {
  if (!trip) {
    tripDetailEmpty.classList.remove("hidden");
    tripDetailSection.classList.add("hidden");
    resetDetailState();
    renderTabContent();
    return;
  }

  selectedTripId = trip.id;
  tripDetailEmpty.classList.add("hidden");
  tripDetailSection.classList.remove("hidden");
  resetDetailState();

  detailTitle.textContent = formatText(trip.title);
  detailDestination.textContent = formatText(trip.destination);
  detailStartDate.textContent = formatDate(trip.start_date);
  detailEndDate.textContent = formatDate(trip.end_date);
  detailMeetingPlace.textContent = formatText(trip.meeting_place);
  detailMeetingTime.textContent = formatTime(trip.meeting_time);
  detailImportantNote.textContent = formatText(trip.important_note);

  renderTripList();
  renderTabContent();
}

function renderTabContent() {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (activeTab === "places") {
    renderPlacesTab();
    return;
  }

  if (activeTab === "documents") {
    renderDocumentsTab();
  }
}

function renderPlacesTab() {
  const selectedTrip = getSelectedTrip();

  if (!selectedTrip) {
    tabContent.innerHTML = '<p class="panel-text">旅行を選ぶと、行き先が見られます。</p>';
    return;
  }

  if (placeLoadedTripId !== selectedTrip.id && !isPlaceLoading) {
    tabContent.innerHTML = '<p class="panel-text">読み込み中</p>';
    void loadPlaces(selectedTrip.id);
    return;
  }

  if (isPlaceLoading) {
    tabContent.innerHTML = '<p class="panel-text">読み込み中</p>';
    return;
  }

  const formTitle = placeFormMode === "edit" ? "行き先を編集" : "行き先を登録";
  const submitLabel = placeFormMode === "edit" ? "更新する" : "登録する";
  const disabledAttr = isPlaceProcessing || isPlaceLoading ? "disabled" : "";

  tabContent.innerHTML = `
    <div class="section-toolbar">
      <div>
        <h4>確定した行き先</h4>
        <p class="panel-text">選択中の旅行の行き先だけを表示します。</p>
      </div>
      <button type="button" data-action="open-place-form" ${disabledAttr}>新しい行き先を作る</button>
    </div>

    <div id="placeFormSection" class="trip-form ${placeFormOpen ? "" : "hidden"}">
      <h4>${formTitle}</h4>
      <p class="panel-text">trip_idでこの旅行にだけ保存します。</p>

      <form id="placeForm">
        <label for="placeName">場所名</label>
        <input id="placeName" type="text" placeholder="たとえば 大阪城" ${disabledAttr}>

        <label for="placeAddress">住所</label>
        <input id="placeAddress" type="text" placeholder="たとえば 大阪府大阪市中央区大阪城1-1" ${disabledAttr}>

        <label for="placeMapUrl">GoogleマップURL</label>
        <input id="placeMapUrl" type="url" placeholder="https://..." ${disabledAttr}>

        <div class="form-grid">
          <div>
            <label for="placeVisitDate">行く日</label>
            <input id="placeVisitDate" type="date" ${disabledAttr}>
          </div>
          <div>
            <label for="placeVisitTime">行く時間</label>
            <input id="placeVisitTime" type="time" ${disabledAttr}>
          </div>
        </div>

        <label for="placeMemo">メモ</label>
        <textarea id="placeMemo" rows="4" placeholder="気をつけることを書けます" ${disabledAttr}></textarea>

        <div class="button-row">
          <button type="submit" ${disabledAttr}>${submitLabel}</button>
          <button type="button" data-action="close-place-form" class="secondary-button" ${disabledAttr}>閉じる</button>
        </div>

        <p id="placeFormMessage" class="message error schedule-form-status" role="alert" aria-live="assertive">${escapeHtml(placeFormStatus)}</p>
      </form>
    </div>

    <p id="placeListMessage" class="message schedule-list-status" aria-live="polite">${escapeHtml(placeListStatus)}</p>
    <div id="placeList" class="place-grid"></div>
  `;

  if (placeFormOpen) {
    fillPlaceForm();
  }

  renderPlacesList();
}

function renderPlacesList() {
  const listElement = tabContent.querySelector("#placeList");
  const messageElement = tabContent.querySelector("#placeListMessage");

  if (!listElement || !messageElement) {
    return;
  }

  if (isPlaceLoading) {
    messageElement.textContent = "読み込み中";
    listElement.innerHTML = "";
    return;
  }

  if (places.length === 0) {
    messageElement.textContent = placeListStatus || "まだ行き先が登録されていません";
    listElement.innerHTML = "";
    return;
  }

  messageElement.textContent = placeListStatus || "";

  listElement.innerHTML = places
    .map((place) => {
      const isSelected = String(place.id) === String(selectedPlaceId);
      const disabled = isPlaceProcessing ? "disabled" : "";
      const mapUrl = place.map_url || "";

      return `
        <article class="place-card ${isSelected ? "active" : ""}">
          <h4>${escapeHtml(place.name || "-")}</h4>
          <p>住所: ${escapeHtml(place.address || "-")}</p>
          <p>日付: ${formatDate(place.visit_date)}</p>
          <p>時間: ${formatTime(place.visit_time)}</p>
          <p class="note-meta">${escapeHtml(place.memo || "")}</p>
          <div class="place-card-actions">
            ${mapUrl ? `<button type="button" data-action="open-map-url" data-url="${escapeHtml(mapUrl)}" ${disabled}>地図を開く</button>` : ""}
            <button type="button" data-action="edit-place" data-id="${place.id}" ${disabled}>編集</button>
            <button type="button" data-action="delete-place" data-id="${place.id}" class="secondary-button" ${disabled}>削除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillPlaceForm() {
  const place = placeFormMode === "edit" ? getSelectedPlace() : null;
  const nameInput = tabContent.querySelector("#placeName");
  const addressInput = tabContent.querySelector("#placeAddress");
  const mapUrlInput = tabContent.querySelector("#placeMapUrl");
  const visitDateInput = tabContent.querySelector("#placeVisitDate");
  const visitTimeInput = tabContent.querySelector("#placeVisitTime");
  const memoInput = tabContent.querySelector("#placeMemo");

  if (!nameInput || !addressInput || !mapUrlInput || !visitDateInput || !visitTimeInput || !memoInput) {
    return;
  }

  nameInput.value = place?.name || "";
  addressInput.value = place?.address || "";
  mapUrlInput.value = place?.map_url || "";
  visitDateInput.value = place?.visit_date || "";
  visitTimeInput.value = place?.visit_time || "";
  memoInput.value = place?.memo || "";
}

function getPlaceFormValues() {
  const nameInput = tabContent.querySelector("#placeName");
  const addressInput = tabContent.querySelector("#placeAddress");
  const mapUrlInput = tabContent.querySelector("#placeMapUrl");
  const visitDateInput = tabContent.querySelector("#placeVisitDate");
  const visitTimeInput = tabContent.querySelector("#placeVisitTime");
  const memoInput = tabContent.querySelector("#placeMemo");

  return {
    name: normalizeInput(nameInput?.value || ""),
    address: normalizeInput(addressInput?.value || ""),
    map_url: normalizeInput(mapUrlInput?.value || ""),
    visit_date: visitDateInput?.value || "",
    visit_time: visitTimeInput?.value || "",
    memo: normalizeInput(memoInput?.value || ""),
  };
}

function validatePlaceForm(values) {
  if (!values.name) {
    return "場所名を入れてください。";
  }

  return "";
}

function openPlaceForm(mode, placeId = null) {
  if (isPlaceLoading || isPlaceProcessing) {
    return;
  }

  placeFormMode = mode;
  selectedPlaceId = placeId;
  placeFormOpen = true;
  placeFormStatus = "";
  renderPlacesTab();
}

function closePlaceForm() {
  placeFormMode = "create";
  selectedPlaceId = null;
  placeFormOpen = false;
  placeFormStatus = "";
  if (activeTab === "places") {
    renderPlacesTab();
  }
}

function setPlaceListStatus(message) {
  placeListStatus = message;
  if (activeTab === "places") {
    renderPlacesTab();
  }
}

function setPlaceFormStatus(message) {
  placeFormStatus = message;
  if (activeTab === "places") {
    renderPlacesTab();
  }
}

function setPlaceProcessing(nextState) {
  isPlaceProcessing = nextState;
  if (activeTab === "places") {
    renderPlacesTab();
  }
}

async function loadPlaces(tripId) {
  const requestToken = ++placeLoadToken;
  placeLoadedTripId = tripId;
  isPlaceLoading = true;
  placeListStatus = "読み込み中";

  if (activeTab === "places") {
    renderPlacesTab();
  }

  try {
    const { data, error } = await supabaseClient
      .from("places")
      .select("id, trip_id, name, address, map_url, visit_date, visit_time, memo, created_at")
      .eq("group_id", currentGroupId)
      .eq("trip_id", tripId)
      .order("visit_date", { ascending: true })
      .order("visit_time", { ascending: true });

    if (error) {
      throw error;
    }

    if (requestToken !== placeLoadToken) {
      return;
    }

    places = Array.isArray(data) ? data : [];
    selectedPlaceId = places.some((place) => String(place.id) === String(selectedPlaceId)) ? selectedPlaceId : null;
    placeListStatus = places.length === 0 ? "まだ行き先が登録されていません" : "";
  } catch (error) {
    if (requestToken !== placeLoadToken) {
      return;
    }

    places = [];
    selectedPlaceId = null;
    placeListStatus = createFriendlyCrudError("行き先", error);
  } finally {
    if (requestToken !== placeLoadToken) {
      return;
    }

    isPlaceLoading = false;
    if (activeTab === "places") {
      renderPlacesTab();
    }
  }
}

async function savePlace() {
  if (isPlaceProcessing) {
    return;
  }

  const selectedTrip = getSelectedTrip();

  if (!selectedTrip) {
    setPlaceFormStatus("旅行を選んでから登録してください。");
    return;
  }

  const values = getPlaceFormValues();
  const validationMessage = validatePlaceForm(values);

  if (validationMessage) {
    setPlaceFormStatus(validationMessage);
    return;
  }

  setPlaceProcessing(true);
  setPlaceFormStatus(placeFormMode === "edit" ? "更新中" : "登録中");

  try {
    const payload = {
      group_id: currentGroupId,
      trip_id: selectedTrip.id,
      name: values.name,
      address: values.address || null,
      map_url: values.map_url || null,
      visit_date: values.visit_date || null,
      visit_time: values.visit_time || null,
      memo: values.memo || null,
    };

    if (placeFormMode === "edit" && selectedPlaceId) {
      const { error } = await supabaseClient
        .from("places")
        .update(payload)
        .eq("group_id", currentGroupId)
        .eq("id", selectedPlaceId)
        .eq("trip_id", selectedTrip.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabaseClient.from("places").insert([payload]);

      if (error) {
        throw error;
      }
    }

    closePlaceForm();
    await loadPlaces(selectedTrip.id);
  } catch (error) {
    setPlaceFormStatus(createFriendlyCrudError("行き先", error));
  } finally {
    setPlaceProcessing(false);
  }
}

async function deletePlace(placeId) {
  if (isPlaceProcessing) {
    return;
  }

  const selectedTrip = getSelectedTrip();

  if (!selectedTrip) {
    return;
  }

  const shouldDelete = window.confirm("この行き先を削除しますか？");

  if (!shouldDelete) {
    return;
  }

  setPlaceProcessing(true);
  setPlaceListStatus("削除中");

  try {
    const { error } = await supabaseClient
      .from("places")
      .delete()
      .eq("group_id", currentGroupId)
      .eq("id", placeId)
      .eq("trip_id", selectedTrip.id);

    if (error) {
      throw error;
    }

    if (String(selectedPlaceId) === String(placeId)) {
      closePlaceForm();
    }

    await loadPlaces(selectedTrip.id);
  } catch (error) {
    setPlaceListStatus(createFriendlyCrudError("行き先", error));
  } finally {
    setPlaceProcessing(false);
  }
}

function renderDocumentsTab() {
  const selectedTrip = getSelectedTrip();

  if (!selectedTrip) {
    tabContent.innerHTML = '<p class="panel-text">旅行を選ぶと、資料が見られます。</p>';
    return;
  }

  if (documentLoadedTripId !== selectedTrip.id && !isDocumentLoading) {
    tabContent.innerHTML = '<p class="panel-text">読み込み中</p>';
    void loadDocuments(selectedTrip.id);
    return;
  }

  if (isDocumentLoading) {
    tabContent.innerHTML = '<p class="panel-text">読み込み中</p>';
    return;
  }

  const formTitle = documentFormMode === "edit" ? "資料を編集" : "資料を登録";
  const submitLabel = documentFormMode === "edit" ? "更新する" : "登録する";
  const disabledAttr = isDocumentProcessing || isDocumentLoading ? "disabled" : "";
  const selectedDocument = getSelectedDocument();
  const previewUrl = getActiveDocumentPreviewUrl(selectedDocument);
  const imageName = getActiveDocumentImageName(selectedDocument);

  tabContent.innerHTML = `
    <div class="section-toolbar">
      <div>
        <h4>スクショ・メモ</h4>
        <p class="panel-text">選択中の旅行の資料だけを表示します。</p>
      </div>
      <button type="button" data-action="open-document-form" ${disabledAttr}>新しい資料を作る</button>
    </div>

    <div id="documentFormSection" class="trip-form ${documentFormOpen ? "" : "hidden"}">
      <h4>${formTitle}</h4>
      <p class="panel-text">画像、メモ、関連URLをまとめて保存できます。</p>

      <form id="documentForm">
        <label for="documentTitle">タイトル</label>
        <input id="documentTitle" type="text" placeholder="たとえば 予約画面" ${disabledAttr}>

        <label for="documentImageFile">画像</label>
        <input id="documentImageFile" type="file" accept="image/*" ${disabledAttr}>
        <p class="upload-help">スマホ写真やスクショを追加できます。大きい画像は自動で軽くします。</p>
        ${previewUrl ? `
          <div class="document-image-preview-box">
            <img class="document-image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(selectedDocument?.title || "画像プレビュー")}" data-action="open-image" data-url="${escapeHtml(previewUrl)}" data-title="${escapeHtml(selectedDocument?.title || imageName || "画像")}">
            <div class="document-image-preview-meta">
              <span>${escapeHtml(imageName || "画像を追加済み")}</span>
              <button type="button" data-action="remove-document-image" class="secondary-button" ${disabledAttr}>画像を外す</button>
            </div>
          </div>
        ` : `<div class="document-thumb-placeholder inline-placeholder">画像はまだありません</div>`}

        <label for="documentMemo">メモ</label>
        <textarea id="documentMemo" rows="4" placeholder="気をつけることを書けます" ${disabledAttr}></textarea>

        <label for="documentRelatedUrl">関連URL</label>
        <input id="documentRelatedUrl" type="url" placeholder="https://..." ${disabledAttr}>

        <div class="button-row">
          <button type="submit" ${disabledAttr}>${submitLabel}</button>
          <button type="button" data-action="close-document-form" class="secondary-button" ${disabledAttr}>閉じる</button>
        </div>

        <p id="documentFormMessage" class="message error schedule-form-status" role="alert" aria-live="assertive">${escapeHtml(documentFormStatus)}</p>
      </form>
    </div>

    <p id="documentListMessage" class="message schedule-list-status" aria-live="polite">${escapeHtml(documentListStatus)}</p>
    <div id="documentList" class="document-list"></div>
  `;

  if (documentFormOpen) {
    fillDocumentForm();
  }

  renderDocumentsList();
}

function renderDocumentsList() {
  const listElement = tabContent.querySelector("#documentList");
  const messageElement = tabContent.querySelector("#documentListMessage");

  if (!listElement || !messageElement) {
    return;
  }

  if (isDocumentLoading) {
    messageElement.textContent = "読み込み中";
    listElement.innerHTML = "";
    return;
  }

  if (documents.length === 0) {
    messageElement.textContent = documentListStatus || "まだ資料が登録されていません";
    listElement.innerHTML = "";
    return;
  }

  messageElement.textContent = documentListStatus || "";

  listElement.innerHTML = documents
    .map((document) => {
      const isSelected = String(document.id) === String(selectedDocumentId);
      const disabled = isDocumentProcessing ? "disabled" : "";
      const relatedUrl = document.related_url || "";
      const previewUrl = document.preview_url || "";

      return `
        <article class="document-card ${isSelected ? "active" : ""}">
          ${previewUrl ? `<img class="document-image" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(document.title || "画像")}" data-action="open-image" data-url="${escapeHtml(previewUrl)}" data-title="${escapeHtml(document.title || "画像")}">` : `<div class="document-thumb-placeholder">画像なし</div>`}
          <h4>${escapeHtml(document.title || "-")}</h4>
          <p class="note-meta">${escapeHtml(document.memo || "")}</p>
          <div class="document-card-actions">
            ${relatedUrl ? `<button type="button" data-action="open-related-url" data-url="${escapeHtml(relatedUrl)}" ${disabled}>リンクを開く</button>` : ""}
            <button type="button" data-action="edit-document" data-id="${document.id}" ${disabled}>編集</button>
            <button type="button" data-action="delete-document" data-id="${document.id}" class="secondary-button" ${disabled}>削除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function fillDocumentForm() {
  const documentItem = documentFormMode === "edit" ? getSelectedDocument() : null;
  const titleInput = tabContent.querySelector("#documentTitle");
  const memoInput = tabContent.querySelector("#documentMemo");
  const relatedUrlInput = tabContent.querySelector("#documentRelatedUrl");

  if (!titleInput || !memoInput || !relatedUrlInput) {
    return;
  }

  titleInput.value = documentItem?.title || "";
  memoInput.value = documentItem?.memo || "";
  relatedUrlInput.value = documentItem?.related_url || "";
}

function getDocumentFormValues() {
  const titleInput = tabContent.querySelector("#documentTitle");
  const memoInput = tabContent.querySelector("#documentMemo");
  const relatedUrlInput = tabContent.querySelector("#documentRelatedUrl");

  return {
    title: normalizeInput(titleInput?.value || ""),
    memo: normalizeInput(memoInput?.value || ""),
    related_url: normalizeInput(relatedUrlInput?.value || ""),
  };
}

function validateDocumentForm(values) {
  if (!values.title) {
    return "タイトルを入れてください。";
  }

  return "";
}

function openDocumentForm(mode, documentId = null) {
  if (isDocumentLoading || isDocumentProcessing) {
    return;
  }

  documentFormMode = mode;
  selectedDocumentId = documentId;
  documentFormOpen = true;
  documentFormStatus = "";
  resetDocumentDraftState();
  renderDocumentsTab();
}

function closeDocumentForm() {
  documentFormMode = "create";
  selectedDocumentId = null;
  documentFormOpen = false;
  documentFormStatus = "";
  resetDocumentDraftState();
  if (activeTab === "documents") {
    renderDocumentsTab();
  }
}

function setDocumentListStatus(message) {
  documentListStatus = message;
  if (activeTab === "documents") {
    renderDocumentsTab();
  }
}

function setDocumentFormStatus(message) {
  documentFormStatus = message;
  if (activeTab === "documents") {
    renderDocumentsTab();
  }
}

function setDocumentProcessing(nextState) {
  isDocumentProcessing = nextState;
  if (activeTab === "documents") {
    renderDocumentsTab();
  }
}

async function loadDocuments(tripId) {
  const requestToken = ++documentLoadToken;
  documentLoadedTripId = tripId;
  isDocumentLoading = true;
  documentListStatus = "読み込み中";

  if (activeTab === "documents") {
    renderDocumentsTab();
  }

  try {
    const { data, error } = await supabaseClient
      .from("documents")
      .select("id, trip_id, title, image_url, memo, related_url, created_at")
      .eq("group_id", currentGroupId)
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (requestToken !== documentLoadToken) {
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    const mappedRows = rows.map((row) => ({
      ...row,
      preview_url: resolveDocumentPreviewUrl(row.image_url || ""),
    }));

    if (requestToken !== documentLoadToken) {
      return;
    }

    documents = mappedRows;
    selectedDocumentId = documents.some((document) => String(document.id) === String(selectedDocumentId))
      ? selectedDocumentId
      : null;
    documentListStatus = documents.length === 0 ? "まだ資料が登録されていません" : "";
  } catch (error) {
    if (requestToken !== documentLoadToken) {
      return;
    }

    documents = [];
    selectedDocumentId = null;
    documentListStatus = createFriendlyCrudError("資料", error);
  } finally {
    if (requestToken !== documentLoadToken) {
      return;
    }

    isDocumentLoading = false;
    if (activeTab === "documents") {
      renderDocumentsTab();
    }
  }
}

async function saveDocument() {
  if (isDocumentProcessing) {
    return;
  }

  const selectedTrip = getSelectedTrip();

  if (!selectedTrip) {
    setDocumentFormStatus("旅行を選んでから登録してください。");
    return;
  }

  const values = getDocumentFormValues();
  const validationMessage = validateDocumentForm(values);

  if (validationMessage) {
    setDocumentFormStatus(validationMessage);
    return;
  }

  setDocumentProcessing(true);
  setDocumentFormStatus(documentFormMode === "edit" ? "更新中" : "登録中");

  try {
    const currentDocument = documentFormMode === "edit" ? getSelectedDocument() : null;
    const previousImageUrl = currentDocument?.image_url || null;
    let nextImageUrl = previousImageUrl;
    let uploadedImageUrl = "";

    if (documentDraftRemoveImage) {
      nextImageUrl = null;
    }

    if (documentDraftImageFile) {
      setDocumentFormStatus("画像をアップロード中");
      uploadedImageUrl = await uploadDocumentImage(selectedTrip.id, documentDraftImageFile);
      nextImageUrl = uploadedImageUrl;
    }

    const payload = {
      group_id: currentGroupId,
      trip_id: selectedTrip.id,
      title: values.title,
      image_url: nextImageUrl,
      memo: values.memo || null,
      related_url: values.related_url || null,
    };

    if (documentFormMode === "edit" && selectedDocumentId) {
      const { error } = await supabaseClient
        .from("documents")
        .update(payload)
        .eq("group_id", currentGroupId)
        .eq("id", selectedDocumentId)
        .eq("trip_id", selectedTrip.id);

      if (error) {
        if (uploadedImageUrl) {
          await deleteStoredDocumentImage(uploadedImageUrl).catch(() => {});
        }
        throw error;
      }
    } else {
      const { error } = await supabaseClient.from("documents").insert([payload]);

      if (error) {
        if (uploadedImageUrl) {
          await deleteStoredDocumentImage(uploadedImageUrl).catch(() => {});
        }
        throw error;
      }
    }

    if (previousImageUrl && previousImageUrl !== nextImageUrl) {
      await deleteStoredDocumentImage(previousImageUrl).catch(() => {});
    }

    closeDocumentForm();
    await loadDocuments(selectedTrip.id);
  } catch (error) {
    const storageMessage = documentDraftImageFile || documentDraftRemoveImage ? createFriendlyStorageError(error) : "";
    setDocumentFormStatus(storageMessage || createFriendlyCrudError("資料", error));
  } finally {
    setDocumentProcessing(false);
  }
}

async function deleteDocument(documentId) {
  if (isDocumentProcessing) {
    return;
  }

  const selectedTrip = getSelectedTrip();

  if (!selectedTrip) {
    return;
  }

  const shouldDelete = window.confirm("この資料を削除しますか？");

  if (!shouldDelete) {
    return;
  }

  const currentDocument = documents.find((document) => String(document.id) === String(documentId));

  setDocumentProcessing(true);
  setDocumentListStatus("削除中");

  try {
    const { error } = await supabaseClient
      .from("documents")
      .delete()
      .eq("group_id", currentGroupId)
      .eq("id", documentId)
      .eq("trip_id", selectedTrip.id);

    if (error) {
      throw error;
    }

    if (String(selectedDocumentId) === String(documentId)) {
      closeDocumentForm();
    }

    if (currentDocument?.image_url) {
      await deleteStoredDocumentImage(currentDocument.image_url).catch(() => {});
    }

    await loadDocuments(selectedTrip.id);
  } catch (error) {
    setDocumentListStatus(createFriendlyCrudError("資料", error));
  } finally {
    setDocumentProcessing(false);
  }
}

async function applyGroupSession() {
  supabaseClient = createAuthedSupabaseClient(supabaseProjectUrl, supabasePublishableKey);
  selectedTripId = null;
  closeTripForm();
  resetDetailState();
  renderTabContent();
  setAppLockedState(false);
  await loadTrips();
}

async function createGroupAndLogin() {
  resetAuthMessages();

  const groupName = normalizeInput(groupNameInput.value);
  const groupSecret = normalizeInput(groupPasswordCreateInput.value);

  if (!groupName) {
    showMessage(createGroupMessage, "グループ名を入れてください。");
    return;
  }

  if (groupSecret.length < 4) {
    showMessage(createGroupMessage, "合言葉は4文字以上にしてください。");
    return;
  }

  createGroupButton.disabled = true;
  showMessage(createGroupMessage, "作成中");

  try {
    let created = null;

    for (let i = 0; i < 5; i += 1) {
      const generatedGroupId = createGroupId();
      const { data, error } = await bootstrapClient.rpc("create_trip_group", {
        p_group_id: generatedGroupId,
        p_group_name: groupName,
        p_group_secret: groupSecret,
      });

      if (!error) {
        created = data;
        break;
      }

      if (!String(error.message || "").includes("duplicate")) {
        throw error;
      }
    }

    if (!created || !created.group_id) {
      throw new Error("group create failed");
    }

    currentGroupId = String(created.group_id);
    currentGroupName = String(created.group_name || groupName);
    currentGroupSecret = groupSecret;
    saveGroupSession();
    await applyGroupSession();
    showMessage(createGroupMessage, "");
    groupIdInput.value = currentGroupId;
  } catch (error) {
    showMessage(createGroupMessage, createFriendlyCrudError("グループ", error));
  } finally {
    createGroupButton.disabled = false;
  }
}

async function joinGroup() {
  resetAuthMessages();

  const groupId = normalizeInput(groupIdInput.value).toLowerCase();
  const groupSecret = normalizeInput(groupPasswordJoinInput.value);

  if (!groupId) {
    showMessage(joinGroupMessage, "自動発行のグループIDを入れてください。");
    return;
  }

  if (!groupSecret) {
    showMessage(joinGroupMessage, "合言葉を入れてください。");
    return;
  }

  joinGroupButton.disabled = true;
  showMessage(joinGroupMessage, "確認中");

  try {
    const { data, error } = await bootstrapClient.rpc("verify_trip_group", {
      p_group_id: groupId,
      p_group_secret: groupSecret,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const isValid = Boolean(row?.is_valid);

    if (!isValid) {
      showMessage(joinGroupMessage, "グループIDか合言葉が違います。");
      return;
    }

    currentGroupId = groupId;
    currentGroupName = String(row?.group_name || "");
    currentGroupSecret = groupSecret;
    saveGroupSession();
    await applyGroupSession();
    showMessage(joinGroupMessage, "");
  } catch (error) {
    showMessage(joinGroupMessage, createFriendlyCrudError("グループ", error));
  } finally {
    joinGroupButton.disabled = false;
  }
}

async function tryRestoreAndLoginGroup() {
  const hasSession = restoreGroupSession();

  if (!hasSession) {
    setAppLockedState(true);
    return;
  }

  const { data, error } = await bootstrapClient.rpc("verify_trip_group", {
    p_group_id: currentGroupId,
    p_group_secret: currentGroupSecret,
  });

  if (error) {
    clearGroupSession();
    setAppLockedState(true);
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const isValid = Boolean(row?.is_valid);

  if (!isValid) {
    clearGroupSession();
    setAppLockedState(true);
    return;
  }

  currentGroupName = String(row?.group_name || currentGroupName || "");
  await applyGroupSession();
}

function setupEventListeners() {
  authTabCreate.addEventListener("click", () => setAuthTab("create"));
  authTabJoin.addEventListener("click", () => setAuthTab("join"));
  createGroupButton.addEventListener("click", () => {
    void createGroupAndLogin();
  });
  joinGroupButton.addEventListener("click", () => {
    void joinGroup();
  });
  logoutButton.addEventListener("click", handleLogout);

  showTripFormButton.addEventListener("click", openTripForm);
  cancelTripFormButton.addEventListener("click", closeTripForm);
  saveTripButton.addEventListener("click", saveTrip);

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      renderTabContent();
    });
  });

  tabContent.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");

    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    const itemId = actionButton.dataset.id;
    const url = actionButton.dataset.url;

    if (action === "open-place-form") {
      openPlaceForm("create");
      return;
    }

    if (action === "close-place-form") {
      closePlaceForm();
      return;
    }

    if (action === "edit-place" && itemId) {
      openPlaceForm("edit", itemId);
      return;
    }

    if (action === "delete-place" && itemId) {
      void deletePlace(itemId);
      return;
    }

    if (action === "open-map-url" && url) {
      openExternalUrl(url);
      return;
    }

    if (action === "open-document-form") {
      openDocumentForm("create");
      return;
    }

    if (action === "close-document-form") {
      closeDocumentForm();
      return;
    }

    if (action === "edit-document" && itemId) {
      openDocumentForm("edit", itemId);
      return;
    }

    if (action === "delete-document" && itemId) {
      void deleteDocument(itemId);
      return;
    }

    if (action === "remove-document-image") {
      documentDraftImageFile = null;
      revokeDocumentDraftUrl();
      documentDraftImageUrl = "";
      documentDraftImageName = "";
      documentDraftRemoveImage = true;
      renderDocumentsTab();
      return;
    }

    if (action === "open-related-url" && url) {
      openExternalUrl(url);
      return;
    }

    if (action === "open-image" && url) {
      openImageModal(url, actionButton.dataset.title || "画像");
      return;
    }

    if (action === "close-image-modal") {
      closeImageModal();
    }
  });

  tabContent.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();

    if (event.target.id === "placeForm") {
      void savePlace();
      return;
    }

    if (event.target.id === "documentForm") {
      void saveDocument();
    }
  });

  tabContent.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    if (event.target.id === "documentImageFile") {
      const [file] = Array.from(event.target.files || []);
      void handleDocumentImageSelection(file || null).finally(() => {
        if (activeTab === "documents") {
          renderDocumentsTab();
        }
      });
    }
  });

  imagePreviewModal.addEventListener("click", (event) => {
    if (event.target && event.target.dataset.action === "close-image-modal") {
      closeImageModal();
    }
  });

  closeImageModalButton.addEventListener("click", closeImageModal);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !imagePreviewModal.classList.contains("hidden")) {
      closeImageModal();
    }
  });
}

async function loadTrips() {
  showMessage(tripListMessage, "読み込み中");

  try {
    const { data, error } = await supabaseClient
      .from("trips")
      .select("id, title, destination, start_date, end_date, meeting_place, meeting_time, important_note, created_at")
      .eq("group_id", currentGroupId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    trips = Array.isArray(data) ? data : [];

    if (trips.length === 0) {
      selectedTripId = null;
      showTripDetail(null);
      renderTripList();
      return;
    }

    const stillSelected = trips.find((trip) => String(trip.id) === String(selectedTripId));
    const tripToShow = stillSelected || trips[0];
    showTripDetail(tripToShow);
  } catch (error) {
    trips = [];
    selectedTripId = null;
    showTripDetail(null);
    tripList.innerHTML = "";
    showMessage(tripListMessage, createFriendlyCrudError("旅行", error));
  }
}

async function saveTrip() {
  const values = getTripFormValues();

  if (!values.title) {
    showMessage(tripFormMessage, "旅行名を入れてください。");
    return;
  }

  if (values.start_date && values.end_date && values.end_date < values.start_date) {
    showMessage(tripFormMessage, "終了日は開始日より前にできません。");
    return;
  }

  saveTripButton.disabled = true;
  showMessage(tripFormMessage, "登録中");

  try {
    const { error } = await supabaseClient.from("trips").insert([
      {
        group_id: currentGroupId,
        title: values.title,
        destination: values.destination || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        meeting_place: values.meeting_place || null,
        meeting_time: values.meeting_time || null,
        important_note: values.important_note || null,
      },
    ]);

    if (error) {
      throw error;
    }

    closeTripForm();
    await loadTrips();
  } catch (error) {
    showMessage(tripFormMessage, createFriendlyCrudError("旅行", error));
  } finally {
    saveTripButton.disabled = false;
  }
}

function normalizeSupabaseUrl(url) {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

async function startApp() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    showMessage(tripListMessage, "Supabaseの設定がまだです。config.jsを確認してください。");
    showTripFormButton.disabled = true;
    saveTripButton.disabled = true;
    cancelTripFormButton.disabled = true;
    return;
  }

  supabaseProjectUrl = normalizeSupabaseUrl(SUPABASE_URL);
  supabasePublishableKey = SUPABASE_PUBLISHABLE_KEY;
  bootstrapClient = window.supabase.createClient(supabaseProjectUrl, supabasePublishableKey);

  setupEventListeners();
  setAuthTab("create");
  setAppLockedState(true);
  renderTabContent();
  await tryRestoreAndLoginGroup();
}

document.addEventListener("DOMContentLoaded", startApp);
