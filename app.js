// このファイルは、ログインなしで旅行の登録と表示を動かします。
// 旅行、行き先、資料をまとめて使えます。

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
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));

const imagePreviewModal = document.getElementById("imagePreviewModal");
const imagePreview = document.getElementById("imagePreview");
const closeImageModalButton = document.getElementById("closeImageModalButton");

let supabaseClient = null;
let trips = [];
let selectedTripId = null;
let activeTab = "overview";

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
let pendingDocumentImagePath = "";
let currentImagePreviewUrl = "";
let currentImagePreviewTitle = "";

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
  pendingDocumentImagePath = "";
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
      activeTab = "overview";
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

  if (activeTab === "overview") {
    tabContent.innerHTML = `
      <p class="panel-text">この旅行の基本の情報です。</p>
      <p class="panel-text">行き先とスクショ・メモは下のタブで見られます。</p>
    `;
    return;
  }

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
      <p class="panel-text">画像は trip-images に保存し、画像の場所を documents.image_url に入れます。</p>
      ${documentFormMode === "edit" && selectedDocument?.preview_url ? `<img class="document-image" src="${escapeHtml(selectedDocument.preview_url)}" alt="現在の画像">` : ""}

      <form id="documentForm">
        <label for="documentTitle">タイトル</label>
        <input id="documentTitle" type="text" placeholder="たとえば 予約画面" ${disabledAttr}>

        <label for="documentImage">画像</label>
        <input id="documentImage" type="file" accept="image/*" ${disabledAttr}>

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
  const imageInput = tabContent.querySelector("#documentImage");
  const memoInput = tabContent.querySelector("#documentMemo");
  const relatedUrlInput = tabContent.querySelector("#documentRelatedUrl");

  if (!titleInput || !imageInput || !memoInput || !relatedUrlInput) {
    return;
  }

  titleInput.value = documentItem?.title || "";
  memoInput.value = documentItem?.memo || "";
  relatedUrlInput.value = documentItem?.related_url || "";
  imageInput.value = "";

  if (documentFormMode === "edit") {
    pendingDocumentImagePath = documentItem?.image_url || "";
  } else {
    pendingDocumentImagePath = "";
  }
}

function getDocumentFormValues() {
  const titleInput = tabContent.querySelector("#documentTitle");
  const imageInput = tabContent.querySelector("#documentImage");
  const memoInput = tabContent.querySelector("#documentMemo");
  const relatedUrlInput = tabContent.querySelector("#documentRelatedUrl");

  return {
    title: normalizeInput(titleInput?.value || ""),
    imageFile: imageInput?.files?.[0] || null,
    memo: normalizeInput(memoInput?.value || ""),
    related_url: normalizeInput(relatedUrlInput?.value || ""),
  };
}

function validateDocumentForm(values) {
  if (!values.title) {
    return "タイトルを入れてください。";
  }

  if (documentFormMode === "create" && !values.imageFile) {
    return "画像を選んでください。";
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
  renderDocumentsTab();
}

function closeDocumentForm() {
  documentFormMode = "create";
  selectedDocumentId = null;
  documentFormOpen = false;
  documentFormStatus = "";
  pendingDocumentImagePath = "";
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

async function getSignedPreviewUrl(imagePath) {
  if (!imagePath) {
    return "";
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const { data, error } = await supabaseClient.storage.from("trip-images").createSignedUrl(imagePath, 3600);

  if (error) {
    return "";
  }

  return data?.signedUrl || "";
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
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (requestToken !== documentLoadToken) {
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    const mappedRows = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        preview_url: row.image_url ? await getSignedPreviewUrl(row.image_url) : "",
      }))
    );

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

async function uploadDocumentImage(file, tripId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const filePath = `${tripId}/${Date.now()}-${createUniqueId()}-${safeName}`;
  const { error } = await supabaseClient.storage.from("trip-images").upload(filePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

async function deleteDocumentImage(imagePath) {
  if (!imagePath || /^https?:\/\//i.test(imagePath)) {
    return;
  }

  const { error } = await supabaseClient.storage.from("trip-images").remove([imagePath]);

  if (error) {
    throw error;
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

  let uploadedImagePath = pendingDocumentImagePath;
  const existingDocument = documentFormMode === "edit" ? getSelectedDocument() : null;

  try {
    if (values.imageFile) {
      uploadedImagePath = await uploadDocumentImage(values.imageFile, selectedTrip.id);
    }

    const payload = {
      trip_id: selectedTrip.id,
      title: values.title,
      image_url: uploadedImagePath || null,
      memo: values.memo || null,
      related_url: values.related_url || null,
    };

    if (documentFormMode === "edit" && selectedDocumentId) {
      const { error } = await supabaseClient
        .from("documents")
        .update(payload)
        .eq("id", selectedDocumentId)
        .eq("trip_id", selectedTrip.id);

      if (error) {
        throw error;
      }

      if (values.imageFile && existingDocument?.image_url && existingDocument.image_url !== uploadedImagePath) {
        try {
          await deleteDocumentImage(existingDocument.image_url);
        } catch {
          // 画像の削除に失敗しても、資料の更新は止めません。
        }
      }
    } else {
      const { error } = await supabaseClient.from("documents").insert([payload]);

      if (error) {
        throw error;
      }
    }

    closeDocumentForm();
    await loadDocuments(selectedTrip.id);
  } catch (error) {
    if (values.imageFile && uploadedImagePath && documentFormMode === "create") {
      try {
        await deleteDocumentImage(uploadedImagePath);
      } catch {
        // 失敗しても続けます。
      }
    }

    if (values.imageFile && uploadedImagePath && documentFormMode === "edit" && existingDocument?.image_url !== uploadedImagePath) {
      try {
        await deleteDocumentImage(uploadedImagePath);
      } catch {
        // 失敗しても続けます。
      }
    }

    setDocumentFormStatus(createFriendlyCrudError("資料", error));
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
      .eq("id", documentId)
      .eq("trip_id", selectedTrip.id);

    if (error) {
      throw error;
    }

    if (currentDocument?.image_url) {
      try {
        await deleteDocumentImage(currentDocument.image_url);
      } catch {
        // 画像の削除に失敗しても、資料の削除は進めます。
      }
    }

    if (String(selectedDocumentId) === String(documentId)) {
      closeDocumentForm();
    }

    await loadDocuments(selectedTrip.id);
  } catch (error) {
    setDocumentListStatus(createFriendlyCrudError("資料", error));
  } finally {
    setDocumentProcessing(false);
  }
}

function setupEventListeners() {
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

  const projectUrl = normalizeSupabaseUrl(SUPABASE_URL);
  supabaseClient = window.supabase.createClient(projectUrl, SUPABASE_PUBLISHABLE_KEY);

  setupEventListeners();
  renderTabContent();
  await loadTrips();
}

document.addEventListener("DOMContentLoaded", startApp);
