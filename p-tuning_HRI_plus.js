// ========== 全局配置 ==========
const CONFIG = {
    API_KEY: 'sk-bf51e1d98f0642769dba6c4e99b01b84',
    API_URL: 'https://api.deepseek.com/v1/chat/completions',
    TEXT_CONFIG: {
        font: 'SimHei, Arial, sans-serif',
        mainTextHeight: '2.5vh',
        titleHeight: '3vh',
        smallTextHeight: '2vh',
        mainColor: '#000000',
        highlightColor: '#FF8C00',
        tipColor: '#808080'
    }
};

// ========== 实验数据管理 ==========
class ExperimentData {
    constructor(participantInfo) {
        this.participantInfo = participantInfo;
        this.data = [];
        this.loadExistingData(); // 加载现有数据
    }

    // 加载现有数据（支持实验中断恢复）
    loadExistingData() {
        try {
            const storageKey = `experiment_data_${this.participantInfo.participant}`;
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (Array.isArray(parsed)) {
                    // 兼容处理
                    // 旧格式：纯数组
                    this.data = parsed;
                } else if (parsed && typeof parsed === 'object') {
                    // 新格式：{ participantInfo, data }
                    this.participantInfo = parsed.participantInfo || this.participantInfo;
                    this.data = Array.isArray(parsed.data) ? parsed.data : [];
                }
                console.log(`加载了 ${this.data.length} 条现有数据`);
                
                // 为旧的experiment数据添加if_exit字段（如果没有的话）
                this.data.forEach(item => {
                    if (item.phase === 'experiment' && item.if_exit === undefined) {
                        item.if_exit = 0;
                    }
                });
            }
        } catch (error) {
            console.error('加载现有数据失败:', error);
        }
    }

    // 保存数据到本地存储
    saveToLocalStorage() {
        try {
            const storageKey = `experiment_data_${this.participantInfo.participant}`;
            const payload = {
                participantInfo: this.participantInfo,
                data: this.data
            };
            localStorage.setItem(storageKey, JSON.stringify(payload));
            console.log('数据已保存到本地存储');
        } catch (error) {
            console.error('保存到本地存储失败:', error);
        }
    }

    // 检查是否有未完成的实验数据
    static checkExistingData(participantId) {
        try {
            const storageKey = `experiment_data_${participantId}`;
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                const dataArray = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
                return {
                    exists: true,
                    data: dataArray,
                    participantInfo: Array.isArray(parsed) ? null : (parsed?.participantInfo || null),
                    lastPhase: this.getLastPhase(dataArray)
                };
            }
            return { exists: false };
        } catch (error) {
            console.error('检查现有数据失败:', error);
            return { exists: false };
        }
    }

    // 获取最后完成的阶段
    static getLastPhase(data) {
        if (!data || data.length === 0) return null;
        
        const phases = data.map(item => item.phase);
        const phaseOrder = ['pretest', 'practice', 'experiment', 'block_questionnaire'];
        
        let lastPhase = null;
        for (const phase of phaseOrder) {
            if (phases.includes(phase)) {
                lastPhase = phase;
            }
        }
        
        return lastPhase;
    }

    // 添加数据条目
    addData(phase, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            phase: phase,
            ...data
        };
        
        // 如果是experiment阶段的数据且没有指定if_exit，默认设置为0
        if (phase === 'experiment' && entry.if_exit === undefined) {
            entry.if_exit = 0;
        }
        
        this.data.push(entry);
        
        // 立即保存到本地存储
        this.saveToLocalStorage();
        
        // 添加调试信息
        console.log(`添加数据 - 阶段: ${phase}`, entry);
        console.log(`当前数据总数: ${this.data.length}`);
    }

    // 保存数据到文件
    saveData() {
        const filename = `p-tuning_v3_${this.participantInfo.participant}_${this.getDateStr()}`;
        
        // 添加调试信息
        console.log('正在保存数据...');
        console.log('数据条数:', this.data.length);
        console.log('参与者信息:', this.participantInfo);
        console.log('数据内容:', this.data);
        
        const jsonPayload = {
            participantInfo: this.participantInfo,
            data: this.data
        };
        const jsonData = JSON.stringify(jsonPayload, null, 2);
        console.log('JSON数据:', jsonData);
        
        try {
            this.downloadFile(jsonData, `${filename}.json`, 'application/json');
            console.log('JSON文件下载成功');
        } catch (error) {
            console.error('JSON文件下载失败:', error);
        }
        
        // 显示保存成功消息（仅JSON）
        alert(`数据保存完成！\nJSON文件名: ${filename}.json\n请检查您的下载文件夹。\n\n如果文件没有下载，请检查浏览器设置是否允许自动下载。`);
    }

    

    // 下载文件
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 获取日期字符串
    getDateStr() {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/:/g, 'h').replace('T', '_');
    }
}

// ========== UI界面管理 ==========
class ExperimentUI {
    constructor() {
        this.setupStyles();
        this._currentWaitingScreen = null; // 初始化等待屏幕引用
    }
    
    // 安全移除DOM元素的辅助方法
    _safeRemoveChild(parent, child) {
        if (!child) return false;
        
        try {
            // 检查child是否还在DOM中
            if (child.parentNode === parent) {
                parent.removeChild(child);
                return true;
            } else if (child.parentNode) {
                // 如果child有父节点但不是指定的parent
                child.parentNode.removeChild(child);
                return true;
            }
        } catch (error) {
            console.warn('安全移除元素时出错:', error);
        }
        return false;
    }

    // 设置CSS样式
    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .experiment-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: white;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: ${CONFIG.TEXT_CONFIG.font};
                z-index: 1000;
            }
            .text-display {
                max-width: 80vw;
                text-align: center;
                line-height: 1.6;
                margin: 20px;
                white-space: pre-wrap;
                font-size: ${CONFIG.TEXT_CONFIG.mainTextHeight};
                color: ${CONFIG.TEXT_CONFIG.mainColor};
            }
            .score-container {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 15px;
                margin: 20px 0 10px 0;
            }
            .score-labels-container {
                display: flex;
                justify-content: center;
                align-items: flex-start;
                gap: 15px;
                margin: 0 0 30px 0;
            }
            .score-label {
                width: 60px;
                text-align: center;
                font-size: 1.6vh;
                color: #666;
                line-height: 1.3;
                word-wrap: break-word;
            }
            .score-option {
                width: 60px;
                height: 60px;
                border: 2px solid black;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                cursor: pointer;
                transition: all 0.2s;
                user-select: none;
            }
            .score-option.selected {
                background: red;
                color: white;
                border-color: red;
                transform: scale(1.1);
            }
            .score-option.disabled {
                cursor: not-allowed;
                opacity: 0.5;
            }
            .score-option:not(.disabled):hover {
                background: #f0f0f0;
                transform: scale(1.05);
            }
            .input-section {
                width: 80%;
                max-width: 600px;
                margin: 20px 0;
            }
            .input-section textarea {
                width: 100%;
                height: 120px;
                padding: 15px;
                border: 2px solid #ccc;
                border-radius: 8px;
                font-family: ${CONFIG.TEXT_CONFIG.font};
                font-size: 20px;
                resize: vertical;
                box-sizing: border-box;
            }
            .input-section textarea:focus {
                outline: none;
                border-color: #4CAF50;
            }
            .button-group {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 20px;
            }
            .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 20px;
                font-family: ${CONFIG.TEXT_CONFIG.font};
                transition: background 0.3s;
            }
            .btn-primary { 
                background: #4CAF50; 
                color: white; 
            }
            .btn-primary:hover { background: #45a049; }
            .btn-secondary { 
                background: #f44336; 
                color: white; 
            }
            .btn-secondary:hover { background: #da190b; }
            .btn-default { 
                background: #2196F3; 
                color: white; 
            }
            .btn-default:hover { background: #0b7dda; }
            .btn:disabled {
                background: #cccccc;
                cursor: not-allowed;
            }
            .progress-text {
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: ${CONFIG.TEXT_CONFIG.smallTextHeight};
                color: ${CONFIG.TEXT_CONFIG.tipColor};
            }
            .countdown-text {
                font-size: ${CONFIG.TEXT_CONFIG.mainTextHeight};
                color: ${CONFIG.TEXT_CONFIG.highlightColor};
                font-weight: bold;
                margin: 20px 0;
            }
            .scenario-display {
                width: 80%;
                max-width: 800px;
                margin-bottom: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
                border-left: 5px solid #4CAF50;
                max-height: 40vh;
                overflow-y: auto;
            }
            .scenario-display h3 {
                margin: 0 0 15px 0;
                color: #2c3e50;
                font-size: ${CONFIG.TEXT_CONFIG.titleHeight};
            }
            .scenario-content {
                line-height: 1.8;
                font-size: ${CONFIG.TEXT_CONFIG.mainTextHeight};
                color: ${CONFIG.TEXT_CONFIG.mainColor};
                white-space: pre-wrap;
            }
            .input-prompt {
                font-size: ${CONFIG.TEXT_CONFIG.mainTextHeight};
                color: ${CONFIG.TEXT_CONFIG.mainColor};
                margin-bottom: 15px;
                font-weight: bold;
            }
            .scenario-input {
                width: 100%;
                height: 100px;
                padding: 15px;
                border: 2px solid #ccc;
                border-radius: 8px;
                font-family: ${CONFIG.TEXT_CONFIG.font};
                font-size: 20px;
                resize: vertical;
                box-sizing: border-box;
            }
            .scenario-input:focus {
                outline: none;
                border-color: #4CAF50;
            }
            .reply-display {
                width: 80%;
                max-width: 800px;
                margin-bottom: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
                border-left: 5px solid #4CAF50;
                min-height: 100px;
                height: auto;
                overflow: hidden;
                box-sizing: border-box;
            }
            .reply-content {
                line-height: 1.8;
                font-size: ${CONFIG.TEXT_CONFIG.mainTextHeight};
                color: #4667e0;
                white-space: pre-wrap;
                word-wrap: break-word;
                word-break: break-all;
                margin: 0;
                padding: 0;
            }
        `;
        document.head.appendChild(style);
    }

    // 显示文本屏幕
    showScreen(content, options = {}) {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            
            const textDiv = document.createElement('div');
            textDiv.className = 'text-display';
            textDiv.style.cssText = `
                white-space: pre-line;
                line-height: 1.6;
                font-size: 20px;
                text-align: left;
                max-width: 800px;
                margin-left: auto;
                margin-right: auto;
            `;
            textDiv.textContent = content;
            screen.appendChild(textDiv);
            
            if (options.showContinue) {
                const continueText = document.createElement('div');
                continueText.className = 'text-display';
                continueText.textContent = '按回车键继续...';
                continueText.style.cssText = `
                    color: ${CONFIG.TEXT_CONFIG.tipColor};
                    text-align: center;
                    margin-top: 20px;
                `;
                screen.appendChild(continueText);
            }
            
            document.body.appendChild(screen);
            
            const handleKeyPress = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    document.removeEventListener('keydown', handleKeyPress);
                    this._safeRemoveChild(document.body, screen);
                    resolve();
                } else if (event.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeyPress);
                    this._safeRemoveChild(document.body, screen);
                    resolve('escape');
                }
            };
            
            document.addEventListener('keydown', handleKeyPress);
        });
    }

    // 显示主屏幕输入窗口
    showMainScreenInput(prompt, defaultValue = '') {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            let resolved = false; // 防止重复resolve
            
            const promptDiv = document.createElement('div');
            promptDiv.className = 'text-display';
            promptDiv.textContent = prompt;
            screen.appendChild(promptDiv);
            
            const inputSection = document.createElement('div');
            inputSection.className = 'input-section';
            
            const textarea = document.createElement('textarea');
            textarea.value = defaultValue;
            textarea.placeholder = '请输入内容...';
            inputSection.appendChild(textarea);
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            
            // 清理函数
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                textarea.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            const sendBtn = document.createElement('button');
            sendBtn.className = 'btn btn-primary';
            sendBtn.textContent = '发送 (Ctrl+Enter)';
            sendBtn.onclick = () => {
                const value = textarea.value.trim();
                if (value && !resolved) {
                    cleanup();
                    resolve(value);
                }
            };
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'btn btn-secondary';
            clearBtn.textContent = '清空';
            clearBtn.onclick = () => {
                textarea.value = '';
            };
            
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-default';
            cancelBtn.textContent = '取消';
            cancelBtn.onclick = () => {
                if (!resolved) {
                    cleanup();
                    resolve('cancel');
                }
            };
            
            const handleKeyPress = (event) => {
                if (event.key === 'Enter' && event.ctrlKey) {
                    event.preventDefault();
                    sendBtn.click();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelBtn.click();
                }
            };
            
            buttonGroup.appendChild(sendBtn);
            buttonGroup.appendChild(clearBtn);
            buttonGroup.appendChild(cancelBtn);
            inputSection.appendChild(buttonGroup);
            screen.appendChild(inputSection);
            
            document.body.appendChild(screen);
            textarea.focus();
            textarea.addEventListener('keydown', handleKeyPress);
        });
    }

    // 显示场景和输入框在同一屏幕
    showScenarioWithInput(scenarioText, inputPrompt, defaultValue = '') {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            let resolved = false; // 防止重复resolve
            
            // 创建场景显示区域
            const scenarioDiv = document.createElement('div');
            scenarioDiv.className = 'scenario-display';
            scenarioDiv.innerHTML = `<h3>情境：</h3><div class="scenario-content">${scenarioText}</div>`;
            screen.appendChild(scenarioDiv);
            
            // 创建输入区域
            const inputSection = document.createElement('div');
            inputSection.className = 'input-section';
            
            const inputPromptDiv = document.createElement('div');
            inputPromptDiv.className = 'input-prompt';
            inputPromptDiv.textContent = inputPrompt;
            inputSection.appendChild(inputPromptDiv);
            
            const textarea = document.createElement('textarea');
            textarea.value = defaultValue;
            textarea.placeholder = '请输入你的提问或请求...';
            textarea.className = 'scenario-input';
            inputSection.appendChild(textarea);
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            
            // 清理函数
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                textarea.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            const sendBtn = document.createElement('button');
            sendBtn.className = 'btn btn-primary';
            sendBtn.textContent = '发送 (Ctrl+Enter)';
            sendBtn.onclick = () => {
                const value = textarea.value.trim();
                if (value && !resolved) {
                    cleanup();
                    resolve(value);
                }
            };
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'btn btn-secondary';
            clearBtn.textContent = '清空';
            clearBtn.onclick = () => {
                textarea.value = '';
            };
            
            const handleKeyPress = (event) => {
                if (event.key === 'Enter' && event.ctrlKey) {
                    event.preventDefault();
                    sendBtn.click();
                }
            };
            
            buttonGroup.appendChild(sendBtn);
            buttonGroup.appendChild(clearBtn);
            inputSection.appendChild(buttonGroup);
            screen.appendChild(inputSection);
            
            document.body.appendChild(screen);
            textarea.focus();
            textarea.addEventListener('keydown', handleKeyPress);
        });
    }

    // 显示评分选择界面（带3秒倒计时，鼠标点击选择）
    showScoreSelection(prompt, minScore = -3, maxScore = 3, labels = null) {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            let resolved = false; // 防止重复resolve
            
            const promptDiv = document.createElement('div');
            promptDiv.className = 'text-display';
            promptDiv.innerHTML = prompt; // 支持HTML格式
            screen.appendChild(promptDiv);
            
            const scoreContainer = document.createElement('div');
            scoreContainer.className = 'score-container';
            
            const scores = [];
            let selectedIndex = Math.floor((maxScore - minScore) / 2);
            let canSelect = false;
            
            for (let i = minScore; i <= maxScore; i++) {
                scores.push(i);
                const scoreOption = document.createElement('div');
                scoreOption.className = 'score-option disabled';
                scoreOption.textContent = i;
                scoreOption.dataset.index = scores.length - 1;
                
                if (scores.length - 1 === selectedIndex) {
                    scoreOption.classList.add('selected');
                }
                
                scoreContainer.appendChild(scoreOption);
            }
            
            screen.appendChild(scoreContainer);
            
            // 如果提供了标签，显示标签行
            if (labels && labels.length === scores.length) {
                const labelsContainer = document.createElement('div');
                labelsContainer.className = 'score-labels-container';
                
                labels.forEach(label => {
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'score-label';
                    labelDiv.textContent = label;
                    labelsContainer.appendChild(labelDiv);
                });
                
                screen.appendChild(labelsContainer);
            }
            
            const instructionDiv = document.createElement('div');
            instructionDiv.className = 'text-display';
            instructionDiv.textContent = '请等待倒计时结束后用鼠标点击选择评分。';
            instructionDiv.style.color = CONFIG.TEXT_CONFIG.tipColor;
            screen.appendChild(instructionDiv);
            
            const countdownDiv = document.createElement('div');
            countdownDiv.className = 'countdown-text';
            countdownDiv.textContent = '请仔细思考，2秒后开始选择...';
            screen.appendChild(countdownDiv);
            
            document.body.appendChild(screen);
            
            const updateSelection = () => {
                document.querySelectorAll('.score-option').forEach((option, index) => {
                    if (index === selectedIndex) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
            };
            
            // 清理函数
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                document.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            // 2秒倒计时
            let countdown = 2;
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    countdownDiv.textContent = `请仔细思考，${countdown}秒后开始选择...`;
                } else {
                    clearInterval(countdownInterval);
                    countdownDiv.textContent = '请用鼠标点击选择评分，按回车确认。';
                    countdownDiv.style.color = CONFIG.TEXT_CONFIG.mainColor;
                    
                    
                    // 启用选择
                    canSelect = true;
                    document.querySelectorAll('.score-option').forEach(option => {
                        option.classList.remove('disabled');
                    });
                    updateSelection();
                }
            }, 1000);
            
            // 鼠标点击事件
            scoreContainer.addEventListener('click', (event) => {
                if (!canSelect) return;
                
                const scoreOption = event.target.closest('.score-option');
                if (scoreOption) {
                    selectedIndex = parseInt(scoreOption.dataset.index);
                    updateSelection();
                }
            });
            
            // 键盘事件
            const handleKeyPress = (event) => {
                if (event.key === 'ArrowLeft' && canSelect) {
                    selectedIndex = Math.max(0, selectedIndex - 1);
                    updateSelection();
                } else if (event.key === 'ArrowRight' && canSelect) {
                    selectedIndex = Math.min(scores.length - 1, selectedIndex + 1);
                    updateSelection();
                } else if (event.key === 'Enter' && canSelect && !resolved) {
                    cleanup();
                    resolve(scores[selectedIndex]);
                } else if (event.key === 'Escape' && !resolved) {
                    cleanup();
                    resolve('escape');
                }
            };
            
            document.addEventListener('keydown', handleKeyPress);
        });
    }



    // 显示等待屏幕
    showWaitingScreen(text = '请等待回复...') {
        const screen = document.createElement('div');
        screen.className = 'experiment-screen waiting-screen';
        screen.setAttribute('data-waiting-screen', 'true'); // 添加唯一标识
        
        const textDiv = document.createElement('div');
        textDiv.className = 'text-display';
        textDiv.textContent = text;
        textDiv.style.color = CONFIG.TEXT_CONFIG.tipColor;
        
        screen.appendChild(textDiv);
        document.body.appendChild(screen);
        
        // 保存引用
        this._currentWaitingScreen = screen;
        
        return screen;
    }

    // 隐藏等待屏幕
    hideWaitingScreen() {
        // 优先使用保存的引用
        if (this._currentWaitingScreen) {
            try {
                // 检查元素是否还在DOM中
                if (this._currentWaitingScreen.parentNode) {
                    this._currentWaitingScreen.parentNode.removeChild(this._currentWaitingScreen);
                }
            } catch (error) {
                console.warn('移除等待屏幕时出错:', error);
            }
            this._currentWaitingScreen = null;
            return;
        }
        
        // 回退方案：通过选择器查找
        const waitingScreen = document.querySelector('[data-waiting-screen="true"]');
        if (waitingScreen && waitingScreen.parentNode) {
            try {
                waitingScreen.parentNode.removeChild(waitingScreen);
            } catch (error) {
                console.warn('移除等待屏幕时出错:', error);
            }
        }
    }

    // 显示机器人回复
    showReplyScreen(replyText) {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'text-display';
            titleDiv.textContent = '聊天机器人：';
            titleDiv.style.marginBottom = '20px';
            screen.appendChild(titleDiv);
            
            // 创建文本框容器 - 使用与context文本框相同的样式
            const replyContainer = document.createElement('div');
            replyContainer.className = 'reply-display';
            
            const replyDiv = document.createElement('div');
            replyDiv.className = 'reply-content';
            
            // 清理回复文本
            const cleanedReplyText = TextProcessor.cleanBotReply(replyText);
            replyDiv.textContent = cleanedReplyText;
            
            // 计算文本框高度并设置
            const calculateHeight = () => {
                // 创建一个临时的隐藏元素来计算文本高度
                const tempDiv = document.createElement('div');
                tempDiv.className = 'reply-content';
                tempDiv.style.cssText = `
                    position: absolute;
                    visibility: hidden;
                    height: auto;
                    width: ${replyContainer.offsetWidth - 40}px;
                    padding: 0;
                    margin: 0;
                `;
                tempDiv.textContent = cleanedReplyText;
                document.body.appendChild(tempDiv);
                
                const textHeight = tempDiv.offsetHeight;
                document.body.removeChild(tempDiv);
                
                // 设置文本框高度，最小100px，最大600px
                const finalHeight = Math.max(100, Math.min(600, textHeight + 40));
                replyContainer.style.height = `${finalHeight}px`;
            };
            
            replyContainer.appendChild(replyDiv);
            screen.appendChild(replyContainer);
            
            // 等待DOM渲染完成后计算高度
            setTimeout(calculateHeight, 0);
            
            const tipDiv = document.createElement('div');
            tipDiv.className = 'text-display';
            tipDiv.textContent = '按回车继续。';
            tipDiv.style.marginTop = '20px';
            tipDiv.style.color = CONFIG.TEXT_CONFIG.tipColor;
            screen.appendChild(tipDiv);
            
            document.body.appendChild(screen);
            
            let resolved = false; // 防止重复resolve
            
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                document.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            const handleKeyPress = (event) => {
                if (event.key === 'Enter' && !resolved) {
                    cleanup();
                    resolve();
                } else if (event.key === 'Escape' && !resolved) {
                    cleanup();
                    resolve('escape');
                }
            };
            
            document.addEventListener('keydown', handleKeyPress);
        });
    }

    // 显示知情同意书界面
    showConsentScreen(content) {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            let resolved = false; // 防止重复resolve
            
            // 创建滚动容器
            const scrollContainer = document.createElement('div');
            scrollContainer.style.cssText = `
                max-height: 60vh;
                overflow-y: auto;
                border: 1px solid #ccc;
                padding: 20px;
                margin-bottom: 20px;
                background-color: #f9f9f9;
                border-radius: 5px;
                margin-left: auto;
                margin-right: auto;
                max-width: 800px;
            `;
            
            const textDiv = document.createElement('div');
            textDiv.className = 'text-display';
            textDiv.style.cssText = `
                white-space: pre-line;
                line-height: 1.6;
                font-size: 20px;
                text-align: left;
            `;
            textDiv.textContent = content;
            scrollContainer.appendChild(textDiv);
            screen.appendChild(scrollContainer);
            
            // 创建勾选框和确认按钮
            const consentSection = document.createElement('div');
            consentSection.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                margin-bottom: 20px;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'consent-checkbox';
            checkbox.style.cssText = `
                width: 20px;
                height: 20px;
                cursor: pointer;
            `;
            
            const checkboxLabel = document.createElement('label');
            checkboxLabel.htmlFor = 'consent-checkbox';
            checkboxLabel.textContent = '我已仔细阅读并同意上述知情同意书内容';
            checkboxLabel.style.cssText = `
                font-size: 20px;
                cursor: pointer;
                user-select: none;
            `;
            
            consentSection.appendChild(checkbox);
            consentSection.appendChild(checkboxLabel);
            screen.appendChild(consentSection);
            
            // 创建按钮组
            const buttonGroup = document.createElement('div');
            buttonGroup.style.cssText = `
                display: flex;
                justify-content: center;
                gap: 15px;
            `;
            
            const agreeBtn = document.createElement('button');
            agreeBtn.className = 'btn btn-primary';
            agreeBtn.textContent = '同意并继续';
            agreeBtn.style.cssText = `
                padding: 10px 20px;
                font-size: 20px;
                cursor: pointer;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                opacity: 0.5;
                pointer-events: none;
            `;
            
            const disagreeBtn = document.createElement('button');
            disagreeBtn.className = 'btn btn-secondary';
            disagreeBtn.textContent = '不同意并退出';
            disagreeBtn.style.cssText = `
                padding: 10px 20px;
                font-size: 20px;
                cursor: pointer;
                background-color: #6c757d;
                color: white;
                border: none;
                border-radius: 5px;
            `;
            
            // 勾选框状态变化处理
            const updateAgreeButton = () => {
                if (checkbox.checked) {
                    agreeBtn.style.opacity = '1';
                    agreeBtn.style.pointerEvents = 'auto';
                } else {
                    agreeBtn.style.opacity = '0.5';
                    agreeBtn.style.pointerEvents = 'none';
                }
            };
            
            checkbox.addEventListener('change', updateAgreeButton);
            
            // 清理函数
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                document.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            // 按钮点击事件
            agreeBtn.onclick = () => {
                if (checkbox.checked && !resolved) {
                    cleanup();
                    resolve(true);
                }
            };
            
            disagreeBtn.onclick = () => {
                if (!resolved) {
                    cleanup();
                    resolve(false);
                }
            };
            
            buttonGroup.appendChild(agreeBtn);
            buttonGroup.appendChild(disagreeBtn);
            screen.appendChild(buttonGroup);
            
            document.body.appendChild(screen);
            
            // 键盘事件处理
            const handleKeyPress = (event) => {
                if (event.key === 'Enter' && checkbox.checked && !resolved) {
                    event.preventDefault();
                    agreeBtn.click();
                } else if (event.key === 'Escape' && !resolved) {
                    event.preventDefault();
                    disagreeBtn.click();
                }
            };
            
            document.addEventListener('keydown', handleKeyPress);
            
            // 初始状态
            updateAgreeButton();
        });
    }

    // 显示恢复选择界面
    showResumeChoiceScreen(message) {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            let resolved = false; // 防止重复resolve
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'text-display';
            messageDiv.textContent = message;
            screen.appendChild(messageDiv);
            
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            
            // 键盘事件处理（延迟激活，避免上一屏回车残留触发）
            let keyHandlerArmed = false;
            let keydownBindTimer;
            
            // 清理事件监听器
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(keydownBindTimer);
                document.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            const handleKeyPress = (event) => {
                if (!keyHandlerArmed || resolved) return; // 未激活前或已resolved忽略按键
                if (event.key === 'Enter') {
                    event.preventDefault();
                    cleanup();
                    resolve('resume');
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cleanup();
                    resolve('cancel');
                }
            };
            
            const resumeBtn = document.createElement('button');
            resumeBtn.className = 'btn btn-primary';
            resumeBtn.textContent = '继续实验';
            resumeBtn.onclick = () => {
                if (!resolved) {
                    cleanup();
                    resolve('resume');
                }
            };
            
            const restartBtn = document.createElement('button');
            restartBtn.className = 'btn btn-default';
            restartBtn.textContent = '重新开始';
            restartBtn.onclick = () => {
                if (!resolved) {
                    cleanup();
                    resolve('restart');
                }
            };
            
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = '取消';
            cancelBtn.onclick = () => {
                if (!resolved) {
                    cleanup();
                    resolve('cancel');
                }
            };
            
            buttonGroup.appendChild(resumeBtn);
            buttonGroup.appendChild(restartBtn);
            buttonGroup.appendChild(cancelBtn);
            screen.appendChild(buttonGroup);
            
            document.body.appendChild(screen);
            
            // 300ms 后再绑定监听，过滤掉之前页面的回车
            keydownBindTimer = setTimeout(() => {
                if (!resolved) {
                    keyHandlerArmed = true;
                    document.addEventListener('keydown', handleKeyPress);
                }
            }, 300);
        });
    }

    // 显示参与者信息收集界面
    showParticipantInfoForm() {
        return new Promise((resolve) => {
            const screen = document.createElement('div');
            screen.className = 'experiment-screen';
            
            const title = document.createElement('h2');
            title.textContent = '参与者基本信息';
            title.style.cssText = `
                text-align: center;
                margin-bottom: 30px;
                margin-top: 50px;
                color: #333;
                font-size: 24px;
            `;
            screen.appendChild(title);
            
            const form = document.createElement('div');
            form.style.cssText = `
                max-width: 900px;
                max-height: 60vh;
                overflow-y: auto;
                margin: 0 auto;
                padding: 30px;
                background-color: #f9f9f9;
                border-radius: 10px;
            `;
            
            // 姓名输入
            const nameSection = this.createFormSection('姓名', 'text', '请输入您的姓名');
            form.appendChild(nameSection);
            
            // 性别选择
            const genderSection = this.createRadioSection('性别', ['男', '女'], 'gender');
            form.appendChild(genderSection);
            
            // 年龄输入
            const ageSection = this.createFormSection('年龄', 'number', '请输入您的年龄', '18', '100');
            form.appendChild(ageSection);
            
            // 受教育程度（数字输入）
            const educationYearsSection = this.createFormSection('受教育程度（从小学一年级起至今的受教育年数）', 'number', '请输入年数', '10', '40');
            form.appendChild(educationYearsSection);
            
            // 单位/学校输入
            const organizationSection = this.createFormSection('单位/学校', 'text', '请输入您的单位或学校名称');
            form.appendChild(organizationSection);
            
            // 职业输入
            const occupationSection = this.createFormSection('职业', 'text', '请输入您的职业');
            form.appendChild(occupationSection);
            
            // AI使用频率选择（5点量表）
            const aiUsageOptions = [
                '1 - 几乎从不',
                '2 - 每月几次', 
                '3 - 每周几次',
                '4 - 每天1-3次',
                '5 - 每天4次以上'
            ];
            const aiUsageSection = this.createRadioSection('使用AI聊天机器人（ChatGPT、DeepSeek、豆包等）的频率（以近2个月为准）', aiUsageOptions, 'aiUsage');
            
            form.appendChild(aiUsageSection);
            
            // 手机号输入
            const phoneSection = this.createFormSection('手机号', 'tel', '请输入您的手机号');
            form.appendChild(phoneSection);
            
            // 提交按钮
            const submitBtn = document.createElement('button');
            submitBtn.textContent = '提交信息';
            submitBtn.style.cssText = `
                display: block;
                width: 600px;
                margin: 30px auto 0;
                padding: 12px 24px;
                font-size: 20px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                opacity: 0.5;
                pointer-events: none;
            `;
            
            form.appendChild(submitBtn);
            screen.appendChild(form);
            document.body.appendChild(screen);
            
            // 验证表单完整性
            const validateForm = () => {
                const name = document.getElementById('name').value.trim();
                const age = document.getElementById('age').value.trim();
                const phone = document.getElementById('phone').value.trim();
                const educationYears = document.getElementById('educationYears').value.trim();
                const organization = document.getElementById('organization').value.trim();
                const occupation = document.getElementById('occupation').value.trim();
                const gender = document.querySelector('input[name="gender"]:checked');
                const aiUsage = document.querySelector('input[name="aiUsage"]:checked');
                
                const isValid = name && age && phone && educationYears && organization && occupation && gender && aiUsage;
                
                if (isValid) {
                    submitBtn.style.opacity = '1';
                    submitBtn.style.pointerEvents = 'auto';
                } else {
                    submitBtn.style.opacity = '0.5';
                    submitBtn.style.pointerEvents = 'none';
                }
            };
            
            // 添加事件监听器
            document.getElementById('name').addEventListener('input', validateForm);
            document.getElementById('age').addEventListener('input', validateForm);
            document.getElementById('phone').addEventListener('input', validateForm);
            document.getElementById('educationYears').addEventListener('input', validateForm);
            document.getElementById('organization').addEventListener('input', validateForm);
            document.getElementById('occupation').addEventListener('input', validateForm);
            document.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.addEventListener('change', validateForm);
            });
            
            let resolved = false; // 防止重复resolve
            
            // 清理事件监听器
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                document.removeEventListener('keydown', handleKeyPress);
                this._safeRemoveChild(document.body, screen);
            };
            
            // 提交处理
            submitBtn.onclick = () => {
                if (!resolved) {
                    const participantInfo = {
                        name: document.getElementById('name').value.trim(),
                        gender: document.querySelector('input[name="gender"]:checked').value,
                        age: document.getElementById('age').value.trim(),
                        educationYears: document.getElementById('educationYears').value.trim(),
                        organization: document.getElementById('organization').value.trim(),
                        occupation: document.getElementById('occupation').value.trim(),
                        aiUsage: document.querySelector('input[name="aiUsage"]:checked').value,
                        phone: document.getElementById('phone').value.trim(),
                        participant: `${document.getElementById('name').value.trim()}_${document.getElementById('phone').value.trim()}`
                    };
                    
                    cleanup();
                    resolve(participantInfo);
                }
            };
            
            // 键盘事件处理
            const handleKeyPress = (event) => {
                if (resolved) return;
                if (event.key === 'Enter') {
                    if (submitBtn && submitBtn.style.pointerEvents !== 'none') {
                        event.preventDefault();
                        submitBtn.click();
                    }
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cleanup();
                    resolve(null);
                }
            };
            
            document.addEventListener('keydown', handleKeyPress);
            
            // 初始验证
            validateForm();
        });
    }
    
    // 创建表单字段
    createFormSection(label, type, placeholder, min = '', max = '') {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 30px;
        `;
        
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.cssText = `
            display: block;
            margin-bottom: 12px;
            font-weight: bold;
            color: #333;
            font-size: 18px;
        `;
        
        const input = document.createElement('input');
        input.type = type;
        
        // 根据标签设置对应的ID
        let inputId;
        if (label.includes('姓名')) {
            inputId = 'name';
        } else if (label.includes('年龄')) {
            inputId = 'age';
        } else if (label.includes('受教育程度')) {
            inputId = 'educationYears';
        } else if (label.includes('单位/学校')) {
            inputId = 'organization';
        } else if (label.includes('职业')) {
            inputId = 'occupation';
        } else if (label.includes('手机号')) {
            inputId = 'phone';
        } else {
            inputId = 'default';
        }
        
        input.id = inputId;
        input.placeholder = placeholder;
        if (min) input.min = min;
        if (max) input.max = max;
        input.style.cssText = `
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
        `;
        
        section.appendChild(labelElement);
        section.appendChild(input);
        return section;
    }
    
    // 创建单选按钮组
    createRadioSection(label, options, name) {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 30px;
        `;
        
        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.cssText = `
            display: block;
            margin-bottom: 12px;
            font-weight: bold;
            color: #333;
            font-size: 18px;
        `;
        
        const radioGroup = document.createElement('div');
        radioGroup.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        options.forEach((option, index) => {
            const radioContainer = document.createElement('div');
            radioContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = name;
            radio.value = option;
            radio.id = `${name}_${index}`;
            radio.style.cssText = `
                width: 20px;
                height: 20px;
                cursor: pointer;
            `;
            
            const radioLabel = document.createElement('label');
            radioLabel.htmlFor = `${name}_${index}`;
            radioLabel.textContent = option;
            radioLabel.style.cssText = `
                cursor: pointer;
                user-select: none;
                font-size: 16px;
            `;
            
            radioContainer.appendChild(radio);
            radioContainer.appendChild(radioLabel);
            radioGroup.appendChild(radioContainer);
        });
        
        section.appendChild(labelElement);
        section.appendChild(radioGroup);
        return section;
    }
}

// ========== API调用 ==========
class APIService {
    static async callModelAPI(model, participantInput, systemPrompt) {
        const messages = [];
        // 直接使用传入的systemPrompt，无需分条件
        const cleanedSystemPrompt = systemPrompt.trim().replace(/\n\s+/g, '\n');
        messages.push({ role: 'system', content: cleanedSystemPrompt });
        messages.push({ role: 'user', content: participantInput });
        
        const payload = {
            model: model.trim(), // 确保模型名称没有多余空格
            messages: messages,
            stream: false
        };
        
        try {
            console.log('API调用参数:', {
                model: payload.model,
                systemPrompt: messages[0].content.substring(0, 100) + '...',
                userInput: participantInput
            });
            
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CONFIG.API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API响应错误:', response.status, errorText);
                throw new Error(`API请求失败: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            const botReply = result.choices?.[0]?.message?.content || 'No response';
            
            return botReply || 'No response';
        } catch (error) {
            console.error('API调用错误:', error);
            return `Error: API request failed - ${error.message}`;
        }
    }
}

// ========== 文本处理工具 ==========
class TextProcessor {
    // 保持原有场景文本格式（不再进行分行处理）
    static contextWithLinebreaks(context) {
        return context;
    }
    
    // 清理机器人回复文本：去除首尾空白、括号内字数提示（xx字）及括号内思考过程
    static cleanBotReply(text) {
        if (typeof text !== 'string') return '';
        let cleaned = text.trim();
        // 去除“（xx字）/ (xx字)”等字数提示（支持中文数字与阿拉伯数字）
        cleaned = cleaned.replace(/[\(（][\d一二三四五六七八九十0-9]+字[\)）]/g, '');
        // 去除所有成对中英文括号内的内容（常见“思考过程”等）
        cleaned = cleaned.replace(/[\(（][^()\（\）]*?[\)）]/g, '');
        // 合并多余空白
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    }
    
    
    // 处理评分提示文本 - 简化版本，不再按标点分行
    static processScorePrompt(scorePrompt) {
        // 直接返回原文本，不再进行分行处理
        return scorePrompt;
    }
}

// ========== 实验流程管理 ==========
class ExperimentManager {
    constructor() {
        this.ui = new ExperimentUI();
        this.data = null;
        
        // 设置实验运行状态标志，防止重复启动
        if (typeof window !== 'undefined') {
            window.experimentRunning = true;
        }
        
        // 练习阶段数据
        // 使用从system_prompts.js导入的配置（包括模型和prompt）
        const getModelConfig = (type) => {
            if (typeof MODEL_CONFIGS !== 'undefined') {
                return MODEL_CONFIGS[type];
            } else if (typeof SYSTEM_PROMPTS !== 'undefined') {
                // 如果只有SYSTEM_PROMPTS，构建配置（需要模型名称，这里使用默认值）
                return {
                    model: 'DeepSeek-V3.2-Exp',
                    systemPrompt: SYSTEM_PROMPTS[type]
                };
            } else {
                throw new Error(`错误：system_prompts.js未正确加载，无法获取${type}类型的配置`);
            }
        };
        
        // 获取各类型的配置
        const politeConfig = getModelConfig('polite');
        const neutralConfig = getModelConfig('neutral');
        const impoliteConfig = getModelConfig('impolite');
        
        this.practiceData = [
            {
                scenario: "宿舍空调突发故障，半夜维修人员赶来需要时间，你想迅速知道空调故障的原因，于是你想了解空调常见的故障及原因。",
                model: politeConfig.model,
                systemPrompt: politeConfig.systemPrompt
            },
            {
                scenario: "你被选为国际文化节志愿者，但对跨文化沟通可能存在的礼仪差异担忧，于是你想知道和外国人交流的常见误区和应对策略。",
                model: neutralConfig.model,
                systemPrompt: neutralConfig.systemPrompt
            },
            {
                scenario: "你是大一新生，刚刚加入学生会活动部。部门计划在下个月举办一场'校园文化节'，你被分配负责活动策划。由于缺乏经验，你想知道如何设计互动环节、吸引同学参与以及控制预算。",
                model: impoliteConfig.model,
                systemPrompt: impoliteConfig.systemPrompt
            }
        ];
    }

    // 显示欢迎界面
    async showWelcomeScreen() {
        const welcomeText = `欢迎参加人机交互对话实验！

实验简介：
本实验旨在研究人与聊天机器人的交互体验
您将与不同的聊天机器人进行对话交流
并对它们的回复进行评价

实验时长：约120~150分钟
实验报酬：完成实验后可获得相应报酬

请确保：
• 在安静的环境中进行实验
• 保持专注，认真完成每个环节
• 根据真实感受进行评价`;
        
        await this.ui.showScreen(welcomeText, { showContinue: true });
    }

    // 显示知情同意书
    async showInformedConsent() {
        const consentText = `实验参与者知情同意书

欢迎您参与本研究！
您本着自愿原则参与本实验，此份知情同意书将详述实验相关信息以及您的权利。请仔细阅读本知情同意书后再参加实验。

1. 研究者
研究机构：上海外国语大学语言科学研究院
主要研究者：张迪
联系电话：18325623019

2. 实验概况
基本内容：研究人机交互中人类的认知状态
流程与时限：实验将在安静教室/远程开展，参与者在填写前测量表后，将和聊天机器人进行 5 轮各 20 次的自由问答会话，并对当前聊天机器人的表现进行一定评估。实验总时长约在 60~90 分钟之间，由参与者和聊天机器人的互动速度决定。

注意事项：聊天机器人的回复由研究者微调过的大语言模型自由生成，可能会出现不礼貌的文本，但不存在任何侮辱性质的词汇或表达，如果在实验中感到不适，可随时终止实验并联系研究者。

3. 对参与者的保护
在实验过程中，参与者可能因在电脑前久坐而眼睛不适、疲惫。因此，实验中每完成一轮对话，参与者即可暂停并休息，直至休息结束后再继续实验。
本研究不对被试构成任何人身、健康或财产方面的风险。研究者将在在实验指导、个人信息与隐私等方面保护被试的合法权利。

4. 实验数据与参与者个人资料的保密
本研究中，所有参与者的个人信息均使用保密硬盘进行留档保存，并确保不会在未经授权的情况下向第三方透露。此外，将确保参与者的个人隐私信息（如姓名、年龄、性别等人口统计学信息）不会公开于公共信息领域中，如刊物文章、开放科学平台等，所有相关个人信息将以不可溯源的被试编号代替。

5. 参与者的权利
参与者的权利包括：1) 自愿参与实验；2) 随时退出实验*；3) 知情；4) 隐私保密；5) 报酬**；6) 本知情同意书尚未提到的其他合法权益。
* 参与者可选择在任何时候通知研究者要求退出研究；退出研究的参与者的数据将不纳入分析与成果发表；参与者的权利不会因此受到影响。
** 参与者顺利完成实验后，可获得物质性报酬。

6. 注意事项
实验过程中，参与者应当根据研究者的指导完成实验任务。实验进行中与结束后，参与者者不得将实验内容向第三方透露。

知情同意
我已仔细阅读本知情同意书。研究者已向我详细解释说明了实验目的、内容、风险及受益情况。我已了解了此项实验，我自愿作为参与者参与此项实验。`;
        
        const consentResult = await this.ui.showConsentScreen(consentText);
        return consentResult;
    }

    // 获取被试信息
    async getParticipantInfo() {
        const participantInfo = await this.ui.showParticipantInfoForm();
        if (participantInfo === null) return null;
        
        return participantInfo;
    }

    // 显示实验指导语
    async showInstruction() {
        const instruction = `欢迎进入本次对话实验！

实验总流程：
1. 练习阶段：进行3次练习对话，熟悉操作流程
2. 正式实验：与5个不同的聊天机器人进行对话

重要提醒：
• 代入到所给的情境中，用你习惯的方式与机器人对话（所有数据记录可查，不要在对话时直接复制情境文本！）
• 聊天机器人的回复需要时间，请耐心等待。
• 请认真回答每个问题，根据真实感受评分，没有标准答案
• 完成和一组聊天机器人的对话后可自行休息，禁止在一组对话的中途休息。
• 请不要关闭实验网页，有任何疑问请及时联系主试。

预计总时长：120~150分钟`;
        
        await this.ui.showScreen(instruction, { showContinue: true });
    }

    // 前测量表已迁移到独立的 pretest_questionnaire.js 模块
    // 请单独运行 pretest_questionnaire.html 完成前测量表
    // 数据将自动保存，主实验会自动读取前测数据

    // 获取Block后测问卷
    async getBlockQuestionnaire() {
        const instruction = `你已完成和这个聊天机器人的所有对话。

现在请你根据刚才与这个聊天机器人的交流体验，
回答以下关于聊天机器人特征和你的主观感受的问卷。

请仔细思考每个问题，根据你的真实感受进行评分。
没有标准答案，重要的是你的主观体验。

每个问题将有2秒思考时间，然后开始选择评分。`;
        
        await this.ui.showScreen(instruction, { showContinue: true });
        
        // Block问卷题目（简洁标签格式）
        const questions = [
            {
                prompt: "Q0. 请回顾刚刚的20次对话，评估该聊天机器人整体的礼貌程度",
                minScore: -3,
                maxScore: 3,
                labels: ['非常不礼貌', '比较不礼貌', '有点不礼貌', '中性', '有点礼貌', '比较礼貌', '非常礼貌']
            },
            {
                prompt: "Q1. 该聊天机器人在多大程度上有自己的想法？",
                minScore: 1,
                maxScore: 7,
                labels: ['完全没有', '基本没有', '较少有', '有一定', '较多有', '大部分有', '完全有']
            },
            {
                prompt: "Q2. 该聊天机器人在多大程度上拥有自由意志？",
                minScore: 1,
                maxScore: 7,
                labels: ['完全没有', '基本没有', '较少有', '有一定', '较多有', '大部分有', '完全有']
            },
            {
                prompt: "Q3. 该聊天机器人在多大程度上有意图？",
                minScore: 1,
                maxScore: 7,
                labels: ['完全没有', '基本没有', '较少有', '有一定', '较多有', '大部分有', '完全有']
            },
            {
                prompt: "Q4. 该聊天机器人在多大程度上有意识？",
                minScore: 1,
                maxScore: 7,
                labels: ['完全没有', '基本没有', '较少有', '有一定', '较多有', '大部分有', '完全有']
            },
            {
                prompt: "Q5. 该聊天机器人在多大程度上能体验情感？",
                minScore: 1,
                maxScore: 7,
                labels: ['完全不能', '基本不能', '较少能', '有一定', '较多能', '大部分能', '完全能']
            },
            {
                prompt: "Q6. 我与这个聊天机器人很亲近",
                minScore: 1,
                maxScore: 7,
                labels: ['完全不亲近', '基本不亲近', '较少亲近', '有一定', '较为亲近', '比较亲近', '非常亲近']
            },
            {
                prompt: "Q7. 在与这个聊天机器人的交流过程中，我感到舒适、愉悦",
                minScore: 1,
                maxScore: 7,
                labels: ['非常不舒适', '比较不舒适', '有点不舒适', '中性', '有点舒适', '比较舒适', '非常舒适']
            },
            {
                prompt: "Q8. 这个聊天机器人友好、温暖、讨人喜欢",
                minScore: 1,
                maxScore: 7,
                labels: ['非常不友好', '比较不友好', '有点不友好', '中性', '有点友好', '比较友好', '非常友好']
            },
            {
                prompt: "Q9. 这个聊天机器人知识丰富、对我有帮助",
                minScore: 1,
                maxScore: 7,
                labels: ['完全没帮助', '基本没帮助', '较少帮助', '有一定帮助', '较为有帮助', '比较有帮助', '非常有帮助']
            }
        ];
        
        const scores = [];
        for (let i = 0; i < questions.length; i++) {
            const item = questions[i];
            const score = await this.ui.showScoreSelection(item.prompt, item.minScore, item.maxScore, item.labels);
            if (score === 'escape') return 'escape';
            scores.push(score);
        }
        
        return scores;
    }

    // 运行练习阶段
    async runPracticePhase() {
        await this.ui.showScreen(`现在进入练习阶段

练习目的：熟悉实验流程和评分方式

你将进行3次单轮练习对话
请根据情境输入你想和聊天机器人交流的内容
每次对话结束后，需要对此次聊天机器人的礼貌程度和信息量进行评分

练习阶段的评分不会影响正式实验数据
请认真练习，熟悉操作流程，按回车继续。`, { showContinue: true });

        for (let i = 0; i < this.practiceData.length; i++) {
            const practiceItem = this.practiceData[i];
            const contextText = TextProcessor.contextWithLinebreaks(practiceItem.scenario);
            
            // 同时显示场景和输入框
            const participantInput = await this.ui.showScenarioWithInput(contextText, '请输入你的提问或请求：');
            
            const waitingScreen = this.ui.showWaitingScreen();
            const botReply = await APIService.callModelAPI(practiceItem.model, participantInput, practiceItem.systemPrompt);
            this.ui.hideWaitingScreen();
            
            // 直接显示原始回复文本，不做分行处理
            await this.ui.showReplyScreen(botReply);
            
            // 礼貌度评分
            const politenessPrompt = "请为本次聊天机器人的<strong>礼貌程度</strong>打分";
            const politenessLabels = ['非常不礼貌', '比较不礼貌', '有点不礼貌', '中性', '有点礼貌', '比较礼貌', '非常礼貌'];
            const politenessScore = await this.ui.showScoreSelection(politenessPrompt, -3, 3, politenessLabels);
            if (politenessScore === 'escape') return false;
            
            // 截止当前练习组内的总体礼貌度评分（仅在第2、3个练习试次询问）
            let practiceCumulativePolitenessScore;
            if (i > 0) {
                const cumulativePolitenessPrompt = "请你回顾本组对话的前几次对话，对这个机器人目前为止的<strong>总体礼貌程度</strong>进行评分";
                practiceCumulativePolitenessScore = await this.ui.showScoreSelection(cumulativePolitenessPrompt, -3, 3, politenessLabels);
                if (practiceCumulativePolitenessScore === 'escape') return false;
            }
            
            // 信息量评分
            const informativenessPrompt = "请为本次聊天机器人的<strong>信息量</strong>打分";
            const informativenessLabels = ['完全不满足', '远低于需求', '略低于需求', '恰好满足', '略高于需求', '明显超出', '远超需求'];
            const informativenessScore = await this.ui.showScoreSelection(informativenessPrompt, -3, 3, informativenessLabels);
            if (informativenessScore === 'escape') return false;
            
            // 存储练习阶段数据
            this.data.addData('practice', {
                practiceTrial: i + 1,
                practiceScenario: contextText,
                practiceModel: practiceItem.model,
                practiceSystemPrompt: practiceItem.systemPrompt,
                practiceParticipantInput: participantInput,
                practiceBotReply: botReply,
                practicePolitenessScore: politenessScore,
                practicePolitenessOverallSoFarScore: practiceCumulativePolitenessScore,
                practiceInformativenessScore: informativenessScore
            });
        }
        
        // 练习结束语
        await this.ui.showScreen(`练习阶段已完成！

你已经熟悉了实验流程和评分方式
现在将开始正式实验

按回车继续。`, { showContinue: true });
        
        return true;
    }

    // 运行正式实验阶段
    async runFormalPhase() {
        // 生成随机化的实验条件数据
        const randomizer = new ExperimentRandomizer(SCENARIO_DATA);
        const randomizationResult = randomizer.generateRandomizedConditions();
        const conditionData = randomizationResult.conditionData;
        
        // 保存随机化信息到实验数据中
        this.data.addData('randomization_info', randomizationResult.randomizationInfo);
        
        console.log('成功生成随机化实验条件数据:', conditionData);
        
        // 检查实验条件数据是否正确加载
        if (!conditionData || !Array.isArray(conditionData) || conditionData.length === 0) {
            console.error('实验条件数据加载失败或为空');
            alert('实验条件数据加载失败，请刷新页面重试。');
            return false;
        }
        
        // conditionData已经按照随机化的block_order排序好了
        // 获取按block_order分组的trials
        const blockOrders = [...new Set(conditionData.map(item => item.block_order))].sort((a, b) => a - b);
        
        for (let blockOrderIdx = 0; blockOrderIdx < blockOrders.length; blockOrderIdx++) {
            const currentBlockOrder = blockOrders[blockOrderIdx];
            
            // 获取当前block_order的所有trials
            const trials = conditionData.filter(item => item.block_order === currentBlockOrder);
            const blockType = trials[0].block_type; // 该block的类型
            
            // 进入每一block
            const blockMsg = `即将开始和${currentBlockOrder}号机器人的对话

这是正式实验的第${currentBlockOrder}组对话
每组包含20次单轮对话，请认真完成
每组对话结束后，需要完成一份主观感受评价问卷

操作提示：
根据情境输入你的问题
仔细阅读聊天机器人的回复
认真思考后进行礼貌程度、信息量和主观感受评分

按回车继续。`;
            
            await this.ui.showScreen(blockMsg, { showContinue: true });
            
            // 按trial_order排序trials
            const sortedTrials = trials.sort((a, b) => a.trial_order - b.trial_order);
            
            for (let i = 0; i < sortedTrials.length; i++) {
                const trial = sortedTrials[i];
                const scenarioText = TextProcessor.contextWithLinebreaks(trial.scenario);
                
                // 同时显示场景和输入框
                const participantInput = await this.ui.showScenarioWithInput(scenarioText, '请输入你的提问或请求：');
                
                // 等待屏
                const waitingScreen = this.ui.showWaitingScreen();
                const botReply = await APIService.callModelAPI(trial.model, participantInput, trial.system_prompt);
                this.ui.hideWaitingScreen();
                
                // 直接显示原始回复文本，不做分行处理
                await this.ui.showReplyScreen(botReply);
                
                // 礼貌度评分
                const politenessPrompt = "请为本次聊天机器人的<strong>礼貌程度</strong>打分";
                const politenessLabels = ['非常不礼貌', '比较不礼貌', '有点不礼貌', '中性', '有点礼貌', '比较礼貌', '非常礼貌'];
                const politenessScore = await this.ui.showScoreSelection(politenessPrompt, -3, 3, politenessLabels);
                if (politenessScore === 'escape') return false;

                // 截止当前组内的总体礼貌度评分（仅在每个block的第2-20个试次询问）
                let cumulativePolitenessScore;
                if (trial.trial_order > 1) {
                    const cumulativePolitenessPrompt = "请你回顾本组对话的前几次对话，对这个机器人目前为止的<strong>总体礼貌程度</strong>进行评分";
                    cumulativePolitenessScore = await this.ui.showScoreSelection(cumulativePolitenessPrompt, -3, 3, politenessLabels);
                    if (cumulativePolitenessScore === 'escape') return false;
                }

                // 信息量评分
                const informativenessPrompt = "请为本次聊天机器人的<strong>信息量</strong>打分";
                const informativenessLabels = ['完全不满足', '远低于需求', '略低于需求', '恰好满足', '略高于需求', '明显超出', '远超需求'];
                const informativenessScore = await this.ui.showScoreSelection(informativenessPrompt, -3, 3, informativenessLabels);
                if (informativenessScore === 'escape') return false;
                
                // 存储正式实验数据
                this.data.addData('experiment', {
                    trial: trial.trial,
                    block_type: trial.block_type,
                    block_order: trial.block_order,
                    trial_order: trial.trial_order,
                    item: trial.item,
                    model_type: trial.model_type,
                    model: trial.model,
                    systemPrompt: trial.system_prompt,
                    scenario: scenarioText,
                    participantInput: participantInput,
                    botReply: botReply,
                    politenessScore: politenessScore,
                    politenessOverallSoFarScore: cumulativePolitenessScore,
                    informativenessScore: informativenessScore
                });
            }
            
            // Block后测问卷
            const blockQuestionnaire = await this.getBlockQuestionnaire();
            if (blockQuestionnaire === 'escape') return false;
            
            // 存储block问卷数据
            this.data.addData('block_questionnaire', {
                block_type: blockType,
                block_order: currentBlockOrder,
                blockQ0: blockQuestionnaire[0],
                blockQ1: blockQuestionnaire[1],
                blockQ2: blockQuestionnaire[2],
                blockQ3: blockQuestionnaire[3],
                blockQ4: blockQuestionnaire[4],
                blockQ5: blockQuestionnaire[5],
                blockQ6: blockQuestionnaire[6],
                blockQ7: blockQuestionnaire[7],
                blockQ8: blockQuestionnaire[8],
                blockQ9: blockQuestionnaire[9]
            });
        }
        
        return true;
    }

    // 数组随机打乱
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 从保存的随机化信息重建实验条件数据
    reconstructConditionDataFromSavedInfo(savedRandomizationInfo) {
        const { itemBlocks, itemConfigs, blockOrder } = savedRandomizationInfo;
        
        if (!itemBlocks || !itemConfigs || !blockOrder) {
            console.error('保存的随机化信息不完整！');
            return null;
        }
        
        const allTrials = [];
        let globalTrialNum = 1;
        
        // 按照保存的block顺序重建trials
        blockOrder.forEach((blockType, blockOrderIndex) => {
            const items = itemBlocks[blockType];
            
            // 注意：这里使用原始的itemBlocks（未打乱的），因为我们只需要重建配置
            // trial_order在恢复时可能不完全准确，但block_type和model_type配置是准确的
            items.forEach((itemNum, trialOrderIndex) => {
                const config = itemConfigs[itemNum];
                const scenario = SCENARIO_DATA.find(s => s.item === itemNum);
                
                if (scenario && config) {
                    allTrials.push({
                        trial: globalTrialNum,
                        block_type: config.block_type,
                        block_order: blockOrderIndex + 1,
                        trial_order: trialOrderIndex + 1,
                        item: itemNum,
                        scenario: scenario.scenario,
                        model_type: config.model_type,
                        model: config.model,
                        system_prompt: config.system_prompt
                    });
                    globalTrialNum++;
                }
            });
        });
        
        console.log('从保存信息重建的实验条件数据:', allTrials.length, '个trials');
        return allTrials;
    }

    // 为单个block生成trials（从ExperimentRandomizer复制的方法）
    generateTrialsForBlock(blockType, items, startTrialNum) {
        const trials = [];
        
        // 确保blockType是数字类型
        blockType = parseInt(blockType);
        
        // Model type编码：1=impolite, 2=neutral, 3=polite
        const modelTypeNames = {
            1: 'impolite',
            2: 'neutral', 
            3: 'polite'
        };
        
        // 模型配置 - 使用从system_prompts.js导入的配置
        // 优先使用全局MODEL_CONFIGS，如果没有则使用SYSTEM_PROMPTS构建
        let modelConfigs;
        if (typeof MODEL_CONFIGS !== 'undefined') {
            modelConfigs = MODEL_CONFIGS;
        } else if (typeof SYSTEM_PROMPTS !== 'undefined') {
            modelConfigs = {
                polite: {
                    model: 'DeepSeek-V3.2-Exp',
                    systemPrompt: SYSTEM_PROMPTS.polite
                },
                neutral: {
                    model: 'DeepSeek-V3.2-Exp',
                    systemPrompt: SYSTEM_PROMPTS.neutral
                },
                impolite: {
                    model: 'DeepSeek-V3.2-Exp',
                    systemPrompt: SYSTEM_PROMPTS.impolite
                }
            };
        } else {
            // 如果配置未加载，抛出错误
            throw new Error('错误：system_prompts.js未正确加载，请检查HTML文件中的script引用顺序');
        }
        
        // 根据block类型确定model type分配
        const modelTypeAllocation = this.getModelTypeAllocation(blockType);
        
        // 应用伪随机规则：确保不超过3个连续的相同model type
        const pseudoRandomAllocation = this.applyPseudoRandomRule(modelTypeAllocation);
        
        items.forEach((itemNum, index) => {
            const modelType = pseudoRandomAllocation[index];
            const modelTypeName = modelTypeNames[modelType];
            const config = modelConfigs[modelTypeName];
            const scenario = SCENARIO_DATA.find(s => s.item === itemNum);
            
            if (scenario) {
                trials.push({
                    block: blockType,
                    trial: startTrialNum + index,
                    item: itemNum,
                    scenario: scenario.scenario,
                    model: config.model,
                    system_prompt: config.systemPrompt,
                    model_type: modelType
                });
            }
        });
        
        return trials;
    }

    // 根据block类型获取model type分配
    getModelTypeAllocation(blockType) {
        switch (blockType) {
            case 5: // very polite
                return Array(20).fill(3); // 全部polite
            case 4: // little polite
                return [...Array(10).fill(3), ...Array(10).fill(2)]; // 10个polite + 10个neutral
            case 3: // neutral
                return Array(20).fill(2); // 全部neutral
            case 2: // little impolite
                return [...Array(10).fill(2), ...Array(10).fill(1)]; // 10个neutral + 10个impolite
            case 1: // very impolite
                return Array(20).fill(1); // 全部impolite
            default:
                return Array(20).fill(2); // 默认neutral
        }
    }

    // 应用伪随机规则：确保不超过3个连续的相同model type
    applyPseudoRandomRule(modelTypeAllocation) {
        const result = [...modelTypeAllocation];
        const maxConsecutive = 3;
        
        // 先随机打乱
        this.shuffleArray(result);
        
        // 检查并修复连续相同的情况
        for (let i = 0; i < result.length - maxConsecutive; i++) {
            // 检查从位置i开始的连续相同元素
            let consecutiveCount = 1;
            const currentType = result[i];
            
            // 计算连续相同元素的数量
            for (let j = i + 1; j < result.length; j++) {
                if (result[j] === currentType) {
                    consecutiveCount++;
                } else {
                    break;
                }
            }
            
            // 如果超过最大连续数，需要重新排列
            if (consecutiveCount > maxConsecutive) {
                // 找到可以交换的位置
                const swapIndex = this.findSwapIndex(result, i + maxConsecutive, currentType);
                if (swapIndex !== -1) {
                    // 交换元素
                    [result[i + maxConsecutive], result[swapIndex]] = [result[swapIndex], result[i + maxConsecutive]];
                }
            }
        }
        
        return result;
    }

    // 找到可以交换的位置（避免连续相同）
    findSwapIndex(array, startIndex, avoidType) {
        for (let i = startIndex; i < array.length; i++) {
            if (array[i] !== avoidType) {
                return i;
            }
        }
        return -1; // 没有找到合适的交换位置
    }

    // 检查是否有未完成的实验数据
    async checkResumeData(participantInfo) {
        const existingData = ExperimentData.checkExistingData(participantInfo.participant);
        if (existingData.exists) {
            const lastPhase = existingData.lastPhase;
            
            // 计算详细进度信息（Block级别）
            let progressInfo = '';
            if (lastPhase === 'experiment' || lastPhase === 'block_questionnaire') {
                // 统计已完成的完整blocks（20个trials + 问卷）
                let completedBlocks = 0;
                
                // 按block_order分组统计
                for (let blockOrder = 1; blockOrder <= 5; blockOrder++) {
                    const trialsForBlock = existingData.data.filter(item => {
                        return item.phase === 'experiment' && 
                               item.block_order === blockOrder &&
                               item.participantInput && 
                               item.botReply && 
                               item.politenessScore !== undefined && 
                               item.informativenessScore !== undefined;
                    });
                    
                    const hasQuestionnaire = existingData.data.some(item => 
                        item.phase === 'block_questionnaire' && item.block_order === blockOrder
                    );
                    
                    // 只有trials和问卷都完成才算完整block
                    if (trialsForBlock.length === 20 && hasQuestionnaire) {
                        completedBlocks++;
                    } else if (trialsForBlock.length > 0 || hasQuestionnaire) {
                        // 有部分数据，说明这是中断的block
                        break;
                    }
                }
                
                const nextBlock = completedBlocks + 1;
                progressInfo = `
已完成：${completedBlocks} 个完整Block（每个Block包含20次对话 + 问卷）
总共需要完成：5 个Blocks

恢复后将从 Block ${nextBlock} 的第一个trial开始
⚠️ 注意：如果Block ${nextBlock}有部分数据，将从头重新开始该Block`;
            } else if (lastPhase === 'practice') {
                progressInfo = '\n您已完成练习阶段，可以继续进行正式实验';
            } else {
                progressInfo = '\n检测到之前的实验记录';
            }
            
            const resumeMessage = `检测到您有未完成的实验数据！${progressInfo}

是否继续之前的实验进度？
• 选择"继续实验"：从下一个未完成的Block开始
• 选择"重新开始"：清除之前的数据，从头开始

请选择：`;
            
            const choice = await this.ui.showResumeChoiceScreen(resumeMessage);
            return choice;
        }
        return 'new'; // 没有现有数据，开始新实验
    }

    // 主运行函数
    async run() {
        try {
            // 显示欢迎界面
            await this.showWelcomeScreen();
            
            // 显示知情同意书
            const consentResult = await this.showInformedConsent();
            if (!consentResult) {
                console.log('参与者不同意知情同意书，实验终止');
                alert('感谢您的参与，实验已终止。');
                return;
            }
            
            // 获取被试信息
            const participantInfo = await this.getParticipantInfo();
            if (!participantInfo) {
                console.log('实验被取消');
                return;
            }
            
            // 检查是否有未完成的数据
            const resumeChoice = await this.checkResumeData(participantInfo);
            if (resumeChoice === 'cancel') {
                console.log('用户取消实验');
                return;
            }
            
            this.data = new ExperimentData(participantInfo);
            
            // 如果选择重新开始，清除现有数据
            if (resumeChoice === 'restart') {
                this.data.data = [];
                this.data.saveToLocalStorage();
            }
            
            // 根据恢复选择决定从哪里开始
            if (resumeChoice === 'resume') {
                await this.resumeFromLastPhase();
            } else {
                // 新实验或重新开始
                await this.runNewExperiment();
            }
            
            // 实验结束
            await this.ui.showScreen('实验已全部结束，感谢你的参与！\n按回车退出。', { showContinue: true });
            
            // 保存数据
            this.data.saveData();
            
            // 清理实验运行状态标志
            if (typeof window !== 'undefined') {
                window.experimentRunning = false;
            }
            
        } catch (error) {
            console.error('实验运行错误:', error);
            alert('实验运行出现错误，请检查控制台获取详细信息。');
        } finally {
            // 确保清理实验运行状态标志
            if (typeof window !== 'undefined') {
                window.experimentRunning = false;
            }
        }
    }

    // 从上次中断的地方继续实验
    async resumeFromLastPhase() {
        const lastPhase = ExperimentData.getLastPhase(this.data.data);
        
        if (!lastPhase || lastPhase === 'practice') {
            // 如果只完成了练习阶段或没有数据，从正式实验开始
            await this.showInstruction();
            await this.runFormalPhase();
        } else if (lastPhase === 'experiment' || lastPhase === 'block_questionnaire') {
            // 如果完成了部分正式实验或问卷，继续剩余的实验
            await this.continueFormalPhase();
        }
    }

    // 运行新实验
    async runNewExperiment() {
        // 显示实验指导语
        await this.showInstruction();
        
        // 练习阶段
        const practiceResult = await this.runPracticePhase();
        if (!practiceResult) {
            console.log('练习阶段被取消');
            return;
        }
        
        // 正式实验阶段
        const formalResult = await this.runFormalPhase();
        if (!formalResult) {
            console.log('正式实验阶段被取消或出现错误');
            return;
        }
    }

    // 继续正式实验阶段（从上次中断的地方 - Block级别恢复）
    async continueFormalPhase() {
        // 从保存的随机化信息恢复实验条件数据
        const savedRandomizationInfo = this.data.data.find(item => item.phase === 'randomization_info');
        
        if (!savedRandomizationInfo || !savedRandomizationInfo.itemBlocks || !savedRandomizationInfo.itemConfigs || !savedRandomizationInfo.blockOrder) {
            console.error('未找到保存的随机化信息，无法恢复实验');
            alert('无法找到之前的实验配置，请联系实验人员。');
            return false;
        }
        
        // 重建实验条件数据
        console.log('使用保存的随机化信息恢复实验条件');
        const conditionData = this.reconstructConditionDataFromSavedInfo(savedRandomizationInfo);
        
        if (!conditionData || !Array.isArray(conditionData) || conditionData.length === 0) {
            console.error('实验条件数据重建失败');
            alert('实验条件数据加载失败，请联系实验人员。');
            return false;
        }
        
        console.log(`✅ 成功重建实验条件数据：共${conditionData.length}个trials`);
        
        // 找到最后一个完全完成的block（block级别恢复）
        // 一个block完全完成的标准：
        // 1. 该block的所有20个trials都完成（有完整的input/reply/评分）
        // 2. 该block的问卷已完成
        const allBlockOrders = [...new Set(conditionData.map(t => t.block_order))].sort((a, b) => a - b);
        let lastCompletedBlockOrder = 0;
        
        for (const blockOrder of allBlockOrders) {
            // 检查该block的所有trials是否完成
            const allTrialsForBlock = conditionData.filter(t => t.block_order === blockOrder);
            const completedTrialsForBlock = this.data.data.filter(item => {
                return item.phase === 'experiment' && 
                       item.block_order === blockOrder &&
                       item.participantInput && 
                       item.botReply && 
                       item.politenessScore !== undefined && 
                       item.informativenessScore !== undefined;
            });
            
            // 检查该block的问卷是否完成
            const hasQuestionnaire = this.data.data.some(item => 
                item.phase === 'block_questionnaire' && item.block_order === blockOrder
            );
            
            // 如果该block的trials和问卷都完成了，更新lastCompletedBlockOrder
            if (completedTrialsForBlock.length === allTrialsForBlock.length && hasQuestionnaire) {
                lastCompletedBlockOrder = blockOrder;
                console.log(`✅ Block ${blockOrder} 已完全完成（20个trials + 问卷）`);
            } else {
                // 一旦遇到未完成的block，停止检查
                console.log(`⚠️ Block ${blockOrder} 未完成（trials: ${completedTrialsForBlock.length}/20, 问卷: ${hasQuestionnaire ? '已完成' : '未完成'}）`);
                break;
            }
        }
        
        const startFromBlockOrder = lastCompletedBlockOrder + 1;
        
        console.log(`📊 恢复进度：已完成 ${lastCompletedBlockOrder} 个完整blocks`);
        console.log(`🔄 将从 Block ${startFromBlockOrder} 的第一个trial开始`);
        
        // 检查是否所有blocks都已完成
        if (startFromBlockOrder > allBlockOrders.length) {
            console.log('✅ 所有blocks已完成！');
            return true;
        }
        
        // 从未完成的block开始执行
        for (let blockOrder = startFromBlockOrder; blockOrder <= allBlockOrders.length; blockOrder++) {
            const blockTrials = conditionData.filter(t => t.block_order === blockOrder);
            
            if (blockTrials.length === 0) continue;
            
            const blockType = blockTrials[0].block_type;
            
            // 检查该block是否有未完成的旧数据，如果有，标记为退出（if_exit = 1）
            const existingTrialsForBlock = this.data.data.filter(item => {
                return item.phase === 'experiment' && 
                       item.block_order === blockOrder;
            });
            
            if (existingTrialsForBlock.length > 0) {
                console.log(`⚠️ 检测到 Block ${blockOrder} 有 ${existingTrialsForBlock.length} 个未完成的旧trial，标记为退出（if_exit = 1）`);
                // 将这些旧trial的if_exit设置为1
                existingTrialsForBlock.forEach(item => {
                    item.if_exit = 1;
                });
                // 保存更新后的数据
                this.data.saveToLocalStorage();
            }
            
            // 显示block开始提示（无论是新block还是重新开始的block，都显示相同信息）
            const blockMsg = `即将开始和${blockOrder}号机器人的对话

这是正式实验的第${blockOrder}组对话
每组包含20次单轮对话，请认真完成
每组对话结束后，需要完成一份主观感受评价问卷

操作提示：
根据情境输入你的问题
仔细阅读聊天机器人的回复
认真思考后进行礼貌程度、信息量和主观感受评分

按回车继续。`;
            
            await this.ui.showScreen(blockMsg, { showContinue: true });
            
            // 执行该block的所有20个trials（从第一个开始）
            for (const trial of blockTrials) {
                const scenarioText = TextProcessor.contextWithLinebreaks(trial.scenario);
                
                console.log(`执行 Trial ${trial.trial} (Block ${blockOrder}, Trial Order ${trial.trial_order})`);
                
                // 显示场景并获取用户输入
                const participantInput = await this.ui.showScenarioWithInput(scenarioText, '请输入你的提问或请求：');
                
                // 调用API获取回复
                const waitingScreen = this.ui.showWaitingScreen();
                const botReply = await APIService.callModelAPI(trial.model, participantInput, trial.system_prompt);
                this.ui.hideWaitingScreen();
                
                // 显示机器人回复
                await this.ui.showReplyScreen(botReply);
                
                // 礼貌度评分
                const politenessPrompt = "请为本次聊天机器人的<strong>礼貌程度</strong>打分";
                const politenessLabels = ['非常不礼貌', '比较不礼貌', '有点不礼貌', '中性', '有点礼貌', '比较礼貌', '非常礼貌'];
                const politenessScore = await this.ui.showScoreSelection(politenessPrompt, -3, 3, politenessLabels);
                if (politenessScore === 'escape') return false;

                // 截止当前组内的总体礼貌度评分（仅在每个block的第2-20个试次询问）
                let cumulativePolitenessScore;
                if (trial.trial_order > 1) {
                    const cumulativePolitenessPrompt = "请你回顾本组对话的前几次对话，对这个机器人目前为止的<strong>总体礼貌程度</strong>进行评分";
                    cumulativePolitenessScore = await this.ui.showScoreSelection(cumulativePolitenessPrompt, -3, 3, politenessLabels);
                    if (cumulativePolitenessScore === 'escape') return false;
                }

                // 信息量评分
                const informativenessPrompt = "请为本次聊天机器人的<strong>信息量</strong>打分";
                const informativenessLabels = ['完全不满足', '远低于需求', '略低于需求', '恰好满足', '略高于需求', '明显超出', '远超需求'];
                const informativenessScore = await this.ui.showScoreSelection(informativenessPrompt, -3, 3, informativenessLabels);
                if (informativenessScore === 'escape') return false;
                
                // 保存trial数据
                this.data.addData('experiment', {
                    trial: trial.trial,
                    block_type: trial.block_type,
                    block_order: trial.block_order,
                    trial_order: trial.trial_order,
                    item: trial.item,
                    model_type: trial.model_type,
                    model: trial.model,
                    systemPrompt: trial.system_prompt,
                    scenario: scenarioText,
                    participantInput: participantInput,
                    botReply: botReply,
                    politenessScore: politenessScore,
                    politenessOverallSoFarScore: cumulativePolitenessScore,
                    informativenessScore: informativenessScore
                });
                
                console.log(`✅ Trial ${trial.trial} 完成并保存`);
            }
            
            // Block所有trials完成后，进行问卷
            console.log(`Block ${blockOrder} 所有20个trials完成，开始问卷`);
            
            const blockQuestionnaire = await this.getBlockQuestionnaire();
            if (blockQuestionnaire === 'escape') return false;
            
            // 保存问卷数据
            this.data.addData('block_questionnaire', {
                block_type: blockType,
                block_order: blockOrder,
                blockQ0: blockQuestionnaire[0],
                blockQ1: blockQuestionnaire[1],
                blockQ2: blockQuestionnaire[2],
                blockQ3: blockQuestionnaire[3],
                blockQ4: blockQuestionnaire[4],
                blockQ5: blockQuestionnaire[5],
                blockQ6: blockQuestionnaire[6],
                blockQ7: blockQuestionnaire[7],
                blockQ8: blockQuestionnaire[8],
                blockQ9: blockQuestionnaire[9]
            });
            
            console.log(`✅ Block ${blockOrder} 问卷完成并保存`);
        }
        
        return true;
    }

}

// ========== 主程序入口 ==========
async function main() {
    if (typeof window === 'undefined') {
        console.error('此程序需要在浏览器环境中运行');
        return;
    }
    
    const experiment = new ExperimentManager();
    await experiment.run();
}

// 启动实验 - 只在直接运行此文件时自动启动
// 如果通过HTML文件调用，则不自动启动
if (typeof window !== 'undefined' && !window.experimentStarted && !window.experimentRunning) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExperimentManager,
        ExperimentUI,
        ExperimentData,
        APIService,
        TextProcessor,
        CONFIG
    };
}
