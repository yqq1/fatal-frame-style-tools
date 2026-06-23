import { FolderOpen, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import CrimsonSelect from './CrimsonSelect';
import {
  defaultOptions,
  fileNameFromSet,
  nextOptionKey,
  questionTypes,
  requestJson,
  sortAnswer,
  type QuizQuestion,
  type QuizQuestionType,
  type QuizOption,
  type QuizSet,
  type QuizSetResponse,
  type QuizSetsResponse,
} from '../lib/quizBank';

function QuizBankWorkbench() {
  const [sets, setSets] = useState<QuizSet[]>([]);
  const [rootPath, setRootPath] = useState('');
  const [rootPathInput, setRootPathInput] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draftSet, setDraftSet] = useState<QuizSet | null>(null);
  const [draftFileName, setDraftFileName] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isApplyingRoot, setIsApplyingRoot] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredSets = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) {
      return sets;
    }

    return sets.filter((set) =>
      [set.id, set.title, set.description, set.badge].some((value) => value.toLocaleLowerCase().includes(keyword)),
    );
  }, [query, sets]);

  async function loadSets(preferredId = selectedId) {
    setIsLoading(true);
    setMessage('');

    try {
      const data = await requestJson<QuizSetsResponse>('/api/quiz/sets');
      const nextSets = Array.isArray(data.sets) ? data.sets : [];
      setRootPath(data.rootPath);
      setRootPathInput(data.rootPath);
      setSets(nextSets);

      const nextId = preferredId && nextSets.some((set) => set.id === preferredId) ? preferredId : nextSets[0]?.id ?? '';
      if (nextId) {
        await loadSet(nextId);
      } else {
        setSelectedId('');
        setDraftSet(null);
        setQuestions([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题库列表读取失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSet(id: string) {
    setIsLoading(true);
    setMessage('');

    try {
      const data = await requestJson<QuizSetResponse>(`/api/quiz/sets/${encodeURIComponent(id)}`);
      setSelectedId(data.set.id);
      setDraftSet(data.set);
      setDraftFileName(fileNameFromSet(data.set));
      setQuestions(data.questions);
      setIsCreating(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题库读取失败');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSets('');
  }, []);

  async function applyRootPath() {
    const nextPath = rootPathInput.trim();
    if (!nextPath) {
      setMessage('题库目录不能为空');
      return;
    }

    setIsApplyingRoot(true);
    setMessage('');

    try {
      const data = await requestJson<QuizSetsResponse>('/api/quiz/root', {
        method: 'PUT',
        body: JSON.stringify({ rootPath: nextPath }),
      });
      const nextSets = Array.isArray(data.sets) ? data.sets : [];
      setRootPath(data.rootPath);
      setRootPathInput(data.rootPath);
      setSets(nextSets);
      setQuery('');

      const nextId = nextSets[0]?.id ?? '';
      if (nextId) {
        await loadSet(nextId);
      } else {
        setSelectedId('');
        setDraftSet(null);
        setQuestions([]);
        setIsCreating(false);
      }

      setMessage('题库目录已保存并切换');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题库目录切换失败');
    } finally {
      setIsApplyingRoot(false);
    }
  }

  function startCreate() {
    setSelectedId('');
    setIsCreating(true);
    setDraftSet({ id: '', title: '', description: '', badge: '题库', file: '', questionCount: 0 });
    setDraftFileName('');
    setQuestions([]);
    setMessage('');
  }

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuestions((current) => current.map((question, itemIndex) => (itemIndex === index ? { ...question, ...patch } : question)));
  }

  function changeQuestionType(index: number, type: QuizQuestionType) {
    setQuestions((current) =>
      current.map((question, itemIndex) => {
        if (itemIndex !== index) {
          return question;
        }

        if (type === 'judge') {
          return { ...question, type, options: [{ key: '对', text: '对' }, { key: '错', text: '错' }], answer: '对' };
        }

        if (type === 'short') {
          return { ...question, type, options: [], answer: '' };
        }

        const options = question.options.length ? question.options : defaultOptions();
        return { ...question, type, options, answer: options[0]?.key ?? 'A' };
      }),
    );
  }

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      {
        id: String(current.length + 1),
        set: draftSet?.id ?? '',
        title: '',
        type: 'single',
        options: defaultOptions(),
        answer: 'A',
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addOption(questionIndex: number) {
    setQuestions((current) =>
      current.map((question, itemIndex) =>
        itemIndex === questionIndex
          ? { ...question, options: [...question.options, { key: nextOptionKey(question.options), text: '' }] }
          : question,
      ),
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, patch: Partial<QuizOption>) {
    setQuestions((current) =>
      current.map((question, itemIndex) => {
        if (itemIndex !== questionIndex) {
          return question;
        }

        const previousKey = question.options[optionIndex]?.key ?? '';
        const options = question.options.map((option, currentIndex) =>
          currentIndex === optionIndex ? { ...option, ...patch } : option,
        );
        const nextAnswer = patch.key && previousKey
          ? sortAnswer(question.answer.split(',').map((key) => (key === previousKey ? patch.key ?? key : key)).join(','))
          : question.answer;

        return { ...question, options, answer: nextAnswer };
      }),
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) =>
      current.map((question, itemIndex) => {
        if (itemIndex !== questionIndex) {
          return question;
        }

        const removedKey = question.options[optionIndex]?.key;
        const options = question.options.filter((_, currentIndex) => currentIndex !== optionIndex);
        const answer = sortAnswer(question.answer.split(',').filter((key) => key !== removedKey).join(','));
        return { ...question, options, answer };
      }),
    );
  }

  function toggleMultipleAnswer(question: QuizQuestion, key: string) {
    const answers = new Set(question.answer.split(',').filter(Boolean));
    if (answers.has(key)) {
      answers.delete(key);
    } else {
      answers.add(key);
    }
    return [...answers].sort().join(',');
  }

  async function saveSet() {
    if (!draftSet) {
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const body = JSON.stringify({
        set: isCreating ? { ...draftSet, fileName: draftFileName } : draftSet,
        questions,
      });
      const data = isCreating
        ? await requestJson<QuizSetResponse>('/api/quiz/sets', { method: 'POST', body })
        : await requestJson<QuizSetResponse>(`/api/quiz/sets/${encodeURIComponent(draftSet.id)}`, { method: 'PUT', body });

      setMessage('题库已保存');
      await loadSets(data.set.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题库保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSet() {
    if (!draftSet || isCreating) {
      return;
    }

    if (!window.confirm(`删除题库「${draftSet.title}」？`)) {
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      await requestJson<{ ok: boolean }>(`/api/quiz/sets/${encodeURIComponent(draftSet.id)}`, { method: 'DELETE' });
      setMessage('题库已删除');
      await loadSets('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '题库删除失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="workbench quiz-bank-workbench" aria-label="题库管理工作区">
      <div className="viewfinder"><span /><span /><span /><span /></div>
      <div className="workbench-head">
        <span className="workbench-icon"><Save size={28} aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">csv quiz archive</p>
          <h2>题库管理</h2>
        </div>
      </div>

      <div className="quiz-bank-toolbar">
        <div className="quiz-bank-root-panel">
          <label className="quiz-root-control">
            <span>题库目录</span>
            <input
              value={rootPathInput}
              onChange={(event) => setRootPathInput(event.target.value)}
              placeholder="C:\\Users\\ADMIN\\Desktop\\code\\myhome-page"
            />
          </label>
          <div className="quiz-bank-toolbar-summary">
            <strong>{rootPath || 'QUIZ_BANK_ROOT'}</strong>
            <span>{sets.length} 个题库</span>
          </div>
        </div>
        <div className="quiz-bank-toolbar-actions">
          <button
            type="button"
            onClick={() => void applyRootPath()}
            disabled={isApplyingRoot || isLoading || rootPathInput.trim() === rootPath}
          >
            <FolderOpen size={15} aria-hidden="true" />
            应用目录
          </button>
          <button type="button" onClick={() => void loadSets(selectedId)} disabled={isLoading || isApplyingRoot}>
            <RefreshCw size={15} aria-hidden="true" />
            刷新
          </button>
          <button type="button" onClick={startCreate} disabled={isApplyingRoot}>
            <Plus size={15} aria-hidden="true" />
            新建
          </button>
        </div>
      </div>

      {message ? <p className="quiz-bank-message">{message}</p> : null}

      <div className="quiz-bank-layout">
        <aside className="quiz-bank-sidebar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题库" />
          <div className="quiz-set-list">
            {filteredSets.map((set) => (
              <button
                className={set.id === selectedId ? 'active' : ''}
                key={set.id}
                type="button"
                onClick={() => void loadSet(set.id)}
              >
                <strong>{set.title}</strong>
                <span>{set.badge} · {set.questionCount} 题</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="quiz-bank-editor">
          {draftSet ? (
            <>
              <div className="quiz-meta-grid">
                <label>
                  <span>题库 ID</span>
                  <input value={draftSet.id} disabled={!isCreating} onChange={(event) => setDraftSet({ ...draftSet, id: event.target.value })} />
                </label>
                <label>
                  <span>CSV 文件名</span>
                  <input value={draftFileName} disabled={!isCreating} onChange={(event) => setDraftFileName(event.target.value)} />
                </label>
                <label>
                  <span>标题</span>
                  <input value={draftSet.title} onChange={(event) => setDraftSet({ ...draftSet, title: event.target.value })} />
                </label>
                <label>
                  <span>标签</span>
                  <input value={draftSet.badge} onChange={(event) => setDraftSet({ ...draftSet, badge: event.target.value })} />
                </label>
                <label className="quiz-meta-wide">
                  <span>描述</span>
                  <input value={draftSet.description} onChange={(event) => setDraftSet({ ...draftSet, description: event.target.value })} />
                </label>
              </div>

              <div className="quiz-editor-actions">
                <button type="button" onClick={addQuestion}>
                  <Plus size={15} aria-hidden="true" />
                  添加题目
                </button>
                <button type="button" disabled={isSaving} onClick={() => void saveSet()}>
                  <Save size={15} aria-hidden="true" />
                  {isSaving ? '保存中' : '保存题库'}
                </button>
                <button type="button" disabled={isCreating || isSaving} onClick={() => void deleteSet()}>
                  <Trash2 size={15} aria-hidden="true" />
                  删除题库
                </button>
              </div>

              <div className="quiz-question-list">
                {questions.map((question, index) => (
                  <article className="quiz-question-card" key={`${question.id}-${index}`}>
                    <div className="quiz-question-head">
                      <span>#{index + 1}</span>
                      <CrimsonSelect
                        compact
                        label={`第 ${index + 1} 题类型`}
                        options={questionTypes}
                        value={question.type}
                        onChange={(value) => changeQuestionType(index, value as QuizQuestionType)}
                      />
                      <button type="button" onClick={() => removeQuestion(index)}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>

                    <label>
                      <span>题干</span>
                      <textarea value={question.title} onChange={(event) => updateQuestion(index, { title: event.target.value })} />
                    </label>

                    {question.type === 'short' ? (
                      <label>
                        <span>标准答案</span>
                        <textarea value={question.answer} onChange={(event) => updateQuestion(index, { answer: event.target.value })} />
                      </label>
                    ) : null}

                    {question.type === 'judge' ? (
                      <label>
                        <span>答案</span>
                        <CrimsonSelect
                          compact
                          label={`第 ${index + 1} 题答案`}
                          options={[{ value: '对', label: '对' }, { value: '错', label: '错' }]}
                          value={question.answer || '对'}
                          onChange={(value) => updateQuestion(index, { answer: value })}
                        />
                      </label>
                    ) : null}

                    {question.type === 'single' || question.type === 'multiple' ? (
                      <div className="quiz-options">
                        {question.options.map((option, optionIndex) => (
                          <div className="quiz-option-row" key={`${option.key}-${optionIndex}`}>
                            <input value={option.key} onChange={(event) => updateOption(index, optionIndex, { key: event.target.value })} />
                            <input value={option.text} onChange={(event) => updateOption(index, optionIndex, { text: event.target.value })} />
                            <button
                              className={`quiz-answer-toggle ${
                                (question.type === 'multiple' ? question.answer.split(',').includes(option.key) : question.answer === option.key)
                                  ? 'active'
                                  : ''
                              }`}
                              type="button"
                              aria-pressed={question.type === 'multiple' ? question.answer.split(',').includes(option.key) : question.answer === option.key}
                              onClick={() => updateQuestion(index, {
                                answer: question.type === 'multiple' ? toggleMultipleAnswer(question, option.key) : option.key,
                              })}
                            >
                              答案
                            </button>
                            <button type="button" onClick={() => removeOption(index, optionIndex)}>
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="quiz-add-option" onClick={() => addOption(index)}>
                          <Plus size={14} aria-hidden="true" />
                          添加选项
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="placeholder-panel">
              <div>
                <strong>未选择题库</strong>
                <span>从左侧选择一个题库，或新建题库。</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default QuizBankWorkbench;
