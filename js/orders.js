// 受注一覧・出荷指示機能

let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
const itemsPerPage = 20;
let currentSort = { field: null, direction: 'asc' };
let selectedOrderIds = new Set();

// DOM読み込み後に実行
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    initializeEventListeners();
});

// イベントリスナー初期化
function initializeEventListeners() {
    // 検索・フィルタ
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);

    // 全選択
    document.getElementById('selectAll').addEventListener('click', toggleSelectAll);

    // 一括出荷指示
    document.getElementById('bulkShipBtn').addEventListener('click', bulkShipOrders);

    // ページネーション
    document.getElementById('prevPage').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(currentPage + 1));

    // ソート
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            sortOrders(field);
        });
    });

    // モーダル
    document.getElementById('closeModal').addEventListener('click', closeDetailModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeDetailModal);
    document.getElementById('closeConfirmModal').addEventListener('click', closeConfirmModal);
    document.getElementById('cancelShipBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmShipBtn').addEventListener('click', executeShipping);

    // モーダル外クリックで閉じる
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeDetailModal();
    });
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') closeConfirmModal();
    });
}

// 受注データ読み込み
function loadOrders() {
    allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    filteredOrders = [...allOrders];
    renderOrders();
}

// 受注データ表示
function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');

    tbody.innerHTML = '';

    if (filteredOrders.length === 0) {
        emptyState.style.display = 'block';
        pagination.style.display = 'none';
        document.getElementById('totalCount').textContent = '0';
        return;
    }

    emptyState.style.display = 'none';

    // ページネーション計算
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageOrders = filteredOrders.slice(start, end);

    // テーブル行生成
    pageOrders.forEach(order => {
        const tr = document.createElement('tr');
        const isSelected = selectedOrderIds.has(order.id);

        tr.innerHTML = `
            <td class="checkbox-col">
                <input type="checkbox" class="order-checkbox" data-order-id="${order.id}"
                    ${isSelected ? 'checked' : ''}
                    ${order.shippingStatus === '出荷済' ? 'disabled' : ''}>
            </td>
            <td>${order.orderNumber}</td>
            <td>${order.orderDate}</td>
            <td>${order.customerName}</td>
            <td>${order.productName}</td>
            <td>${order.quantity}</td>
            <td>${order.deliveryDate || '-'}</td>
            <td>
                <span class="status-badge ${order.shippingStatus === '未出荷' ? 'pending' : 'shipped'}">
                    ${order.shippingStatus}
                </span>
            </td>
            <td>${order.shippingDate || '-'}</td>
            <td class="actions-col">
                <div class="action-btns">
                    <button class="btn-small btn-detail" onclick="showDetail('${order.id}')">詳細</button>
                    <button class="btn-small btn-ship" onclick="shipOrder('${order.id}')"
                        ${order.shippingStatus === '出荷済' ? 'disabled' : ''}>
                        出荷
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // チェックボックスイベント
    document.querySelectorAll('.order-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // 総件数表示
    document.getElementById('totalCount').textContent = filteredOrders.length;

    // ページネーション表示
    if (totalPages > 1) {
        renderPagination(totalPages);
        pagination.style.display = 'flex';
    } else {
        pagination.style.display = 'none';
    }

    updateSelectionCount();
}

// ページネーション表示
function renderPagination(totalPages) {
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-num' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => changePage(i));
        pageNumbers.appendChild(btn);
    }

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// ページ変更
function changePage(page) {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderOrders();
}

// フィルタ適用
function applyFilters() {
    const orderNumber = document.getElementById('filterOrderNumber').value.trim();
    const customer = document.getElementById('filterCustomer').value.trim().toLowerCase();
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const status = document.getElementById('filterStatus').value;

    filteredOrders = allOrders.filter(order => {
        // 受注番号フィルタ
        if (orderNumber && order.orderNumber !== orderNumber) {
            return false;
        }

        // 顧客名フィルタ
        if (customer && !order.customerName.toLowerCase().includes(customer)) {
            return false;
        }

        // 受注日フィルタ
        if (dateFrom && order.orderDate < dateFrom) {
            return false;
        }
        if (dateTo && order.orderDate > dateTo) {
            return false;
        }

        // ステータスフィルタ
        if (status && order.shippingStatus !== status) {
            return false;
        }

        return true;
    });

    currentPage = 1;
    renderOrders();
}

// フィルタリセット
function resetFilters() {
    document.getElementById('filterOrderNumber').value = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterStatus').value = '';

    filteredOrders = [...allOrders];
    currentPage = 1;
    renderOrders();
}

// ソート
function sortOrders(field) {
    // ソート方向切り替え
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }

    // ソート実行
    filteredOrders.sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];

        // 数値の場合
        if (field === 'quantity') {
            aVal = Number(aVal);
            bVal = Number(bVal);
        }

        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // ソート表示更新
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    const sortedTh = document.querySelector(`[data-sort="${field}"]`);
    sortedTh.classList.add(`sorted-${currentSort.direction}`);

    renderOrders();
}

// チェックボックス変更処理
function handleCheckboxChange(e) {
    const orderId = e.target.dataset.orderId;

    if (e.target.checked) {
        selectedOrderIds.add(orderId);
    } else {
        selectedOrderIds.delete(orderId);
    }

    updateSelectionCount();
}

// 全選択切り替え
function toggleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.order-checkbox:not(:disabled)');

    if (e.target.checked) {
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedOrderIds.add(cb.dataset.orderId);
        });
    } else {
        checkboxes.forEach(cb => {
            cb.checked = false;
            selectedOrderIds.delete(cb.dataset.orderId);
        });
    }

    updateSelectionCount();
}

// 選択数更新
function updateSelectionCount() {
    const count = selectedOrderIds.size;
    document.getElementById('selectedCount').textContent = `${count}件選択中`;
    document.getElementById('bulkShipBtn').disabled = count === 0;
}

// 詳細表示
function showDetail(orderId) {
    const order = allOrders.find(o => o.id == orderId);
    if (!order) return;

    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-label">受注番号:</div>
            <div class="detail-value">${order.orderNumber}</div>

            <div class="detail-label">受注日:</div>
            <div class="detail-value">${order.orderDate}</div>

            <div class="detail-label">顧客コード:</div>
            <div class="detail-value">${order.customerCode || '-'}</div>

            <div class="detail-label">顧客名:</div>
            <div class="detail-value">${order.customerName}</div>

            <div class="detail-label">商品コード:</div>
            <div class="detail-value">${order.productCode || '-'}</div>

            <div class="detail-label">商品名:</div>
            <div class="detail-value">${order.productName}</div>

            <div class="detail-label">数量:</div>
            <div class="detail-value">${order.quantity}</div>

            <div class="detail-label">単価:</div>
            <div class="detail-value">${order.unitPrice ? '¥' + order.unitPrice.toLocaleString() : '-'}</div>

            <div class="detail-label">金額:</div>
            <div class="detail-value">${order.amount ? '¥' + order.amount.toLocaleString() : '-'}</div>

            <div class="detail-label">納期:</div>
            <div class="detail-value">${order.deliveryDate || '-'}</div>

            <div class="detail-label">配送先住所:</div>
            <div class="detail-value">${order.deliveryAddress || '-'}</div>

            <div class="detail-label">配送先電話番号:</div>
            <div class="detail-value">${order.deliveryPhone || '-'}</div>

            <div class="detail-label">出荷ステータス:</div>
            <div class="detail-value">
                <span class="status-badge ${order.shippingStatus === '未出荷' ? 'pending' : 'shipped'}">
                    ${order.shippingStatus}
                </span>
            </div>

            <div class="detail-label">出荷日:</div>
            <div class="detail-value">${order.shippingDate || '-'}</div>

            <div class="detail-label">備考:</div>
            <div class="detail-value">${order.remarks || '-'}</div>
        </div>
    `;

    document.getElementById('detailModal').classList.add('show');
}

// 詳細モーダルを閉じる
function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

// 個別出荷指示
function shipOrder(orderId) {
    const order = allOrders.find(o => o.id == orderId);
    if (!order || order.shippingStatus === '出荷済') return;

    selectedOrderIds.clear();
    selectedOrderIds.add(orderId);

    const message = `受注番号「${order.orderNumber}」を出荷指示しますか？`;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('show');
}

// 一括出荷指示
function bulkShipOrders() {
    if (selectedOrderIds.size === 0) return;

    const message = `選択した${selectedOrderIds.size}件の受注を出荷指示しますか？`;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('show');
}

// 出荷指示実行
function executeShipping() {
    const today = new Date().toISOString().split('T')[0];

    selectedOrderIds.forEach(orderId => {
        const order = allOrders.find(o => o.id == orderId);
        if (order && order.shippingStatus === '未出荷') {
            order.shippingStatus = '出荷済';
            order.shippingDate = today;
        }
    });

    // ローカルストレージ更新
    localStorage.setItem('orders', JSON.stringify(allOrders));

    // 選択クリア
    selectedOrderIds.clear();
    document.getElementById('selectAll').checked = false;

    // 表示更新
    loadOrders();
    closeConfirmModal();

    alert('出荷指示が完了しました');
}

// 確認モーダルを閉じる
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

// グローバル関数として公開
window.showDetail = showDetail;
window.shipOrder = shipOrder;
