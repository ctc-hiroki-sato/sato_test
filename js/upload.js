// 受注データアップロード機能

let selectedFile = null;

// DOM要素取得
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const uploadBtn = document.getElementById('uploadBtn');
const clearBtn = document.getElementById('clearBtn');
const removeFileBtn = document.getElementById('removeFileBtn');
const resultSection = document.getElementById('resultSection');
const successCount = document.getElementById('successCount');
const errorCount = document.getElementById('errorCount');
const errorDetails = document.getElementById('errorDetails');
const errorList = document.getElementById('errorList');
const newUploadBtn = document.getElementById('newUploadBtn');

// ドラッグ&ドロップイベント
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// クリックでファイル選択
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// ファイル選択イベント
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// ファイル選択処理
function handleFileSelect(file) {
    // ファイル形式チェック
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        alert('Excelファイル（.xlsx, .xls）を選択してください');
        return;
    }

    selectedFile = file;
    fileName.textContent = file.name;

    // UI更新
    uploadArea.style.display = 'none';
    fileInfo.style.display = 'flex';
    uploadBtn.disabled = false;
}

// ファイル削除
removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
});

// クリアボタン
clearBtn.addEventListener('click', () => {
    clearFile();
});

function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileName.textContent = '';

    uploadArea.style.display = 'block';
    fileInfo.style.display = 'none';
    uploadBtn.disabled = true;
    resultSection.style.display = 'none';
}

// アップロード処理
uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        alert('ファイルを選択してください');
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = '処理中...';

    try {
        const data = await readExcelFile(selectedFile);
        const result = await processOrderData(data);
        displayResult(result);
    } catch (error) {
        alert('エラーが発生しました: ' + error.message);
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'アップロード';
    }
});

// Excelファイル読み込み
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 最初のシートを取得
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                resolve(jsonData);
            } catch (error) {
                reject(new Error('Excelファイルの読み込みに失敗しました'));
            }
        };

        reader.onerror = () => {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        reader.readAsArrayBuffer(file);
    });
}

// 受注データ処理
async function processOrderData(data) {
    const errors = [];
    const successItems = [];
    const existingOrders = getExistingOrders();

    // 最大件数チェック
    if (data.length > 1000) {
        throw new Error('一度に処理できるデータは1000件までです');
    }

    data.forEach((row, index) => {
        const rowNumber = index + 2; // Excelの行番号（ヘッダー考慮）
        const validationErrors = validateOrderRow(row, rowNumber, existingOrders);

        if (validationErrors.length > 0) {
            errors.push(...validationErrors);
        } else {
            successItems.push(normalizeOrderData(row));
        }
    });

    // 成功データをローカルストレージに保存
    if (successItems.length > 0) {
        saveOrders(successItems);
    }

    return {
        success: successItems.length,
        errors: errors
    };
}

// 受注データバリデーション
function validateOrderRow(row, rowNumber, existingOrders) {
    const errors = [];

    // 必須項目チェック
    const requiredFields = [
        { key: '受注番号', name: '受注番号' },
        { key: '受注日', name: '受注日' },
        { key: '顧客名', name: '顧客名' },
        { key: '商品名', name: '商品名' },
        { key: '数量', name: '数量' }
    ];

    requiredFields.forEach(field => {
        if (!row[field.key] || row[field.key].toString().trim() === '') {
            errors.push({
                row: rowNumber,
                message: `${field.name}は必須項目です`
            });
        }
    });

    // 受注番号重複チェック
    if (row['受注番号']) {
        const orderNumber = row['受注番号'].toString().trim();
        if (existingOrders.includes(orderNumber)) {
            errors.push({
                row: rowNumber,
                message: `受注番号「${orderNumber}」は既に登録されています`
            });
        }
    }

    // 数量が数値かチェック
    if (row['数量'] && isNaN(Number(row['数量']))) {
        errors.push({
            row: rowNumber,
            message: '数量は数値で入力してください'
        });
    }

    // 日付形式チェック（簡易）
    if (row['受注日'] && !isValidDate(row['受注日'])) {
        errors.push({
            row: rowNumber,
            message: '受注日の形式が正しくありません'
        });
    }

    return errors;
}

// 日付バリデーション
function isValidDate(dateValue) {
    if (dateValue instanceof Date) return true;

    const dateStr = dateValue.toString();
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

// データ正規化
function normalizeOrderData(row) {
    return {
        id: Date.now() + Math.random(),
        orderNumber: row['受注番号']?.toString().trim() || '',
        orderDate: formatDate(row['受注日']),
        customerCode: row['顧客コード']?.toString().trim() || '',
        customerName: row['顧客名']?.toString().trim() || '',
        productCode: row['商品コード']?.toString().trim() || '',
        productName: row['商品名']?.toString().trim() || '',
        quantity: Number(row['数量']) || 0,
        unitPrice: Number(row['単価']) || 0,
        amount: Number(row['金額']) || 0,
        deliveryDate: formatDate(row['納期']) || '',
        deliveryAddress: row['配送先住所']?.toString().trim() || '',
        deliveryPhone: row['配送先電話番号']?.toString().trim() || '',
        shippingStatus: '未出荷',
        shippingDate: '',
        remarks: row['備考']?.toString().trim() || '',
        createdAt: new Date().toISOString()
    };
}

// 日付フォーマット
function formatDate(dateValue) {
    if (!dateValue) return '';

    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
}

// 既存受注番号取得
function getExistingOrders() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    return orders.map(order => order.orderNumber);
}

// 受注データ保存
function saveOrders(newOrders) {
    const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = [...existingOrders, ...newOrders];
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
}

// 結果表示
function displayResult(result) {
    successCount.textContent = result.success;
    errorCount.textContent = result.errors.length;

    if (result.errors.length > 0) {
        errorDetails.style.display = 'block';
        errorList.innerHTML = '';

        result.errors.forEach(error => {
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item';
            errorItem.innerHTML = `
                <span class="error-row">${error.row}行目:</span>
                ${error.message}
            `;
            errorList.appendChild(errorItem);
        });
    } else {
        errorDetails.style.display = 'none';
    }

    resultSection.style.display = 'block';
    uploadBtn.textContent = 'アップロード';

    // スクロールして結果を表示
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 新規アップロード
newUploadBtn.addEventListener('click', () => {
    clearFile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
