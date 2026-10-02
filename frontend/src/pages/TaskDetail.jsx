import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { ArrowLeft, CheckCircle2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { tasks } from '../services/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errors';
import { dueInfo, formatDate } from '../utils/format';
import ConfirmModal from '../components/ConfirmModal';
import TaskFormModal from '../components/TaskFormModal';
import { DueBadge, PriorityBadge } from '../components/Badges';
import { EmptyState, ErrorState, LoadingBlock } from '../components/Feedback';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: task, loading, error, reload } = useAsync(() => tasks.get(id), [id]);
  const [modal, setModal] = useState(null);

  if (loading && !task) return <LoadingBlock label="Loading task…" />;
  if (error && !task) {
    const missing = error.response && (error.response.status === 404 || error.response.status === 400);
    return (
      <div>
        <Link to="/tasks" className="d-inline-flex align-items-center gap-1 mb-3">
          <ArrowLeft size={16} aria-hidden="true" /> Tasks
        </Link>
        {missing ? <EmptyState title="Task not found">It may have been deleted.</EmptyState> : <ErrorState error={error} onRetry={reload} />}
      </div>
    );
  }

  const toggle = async () => {
    try {
      await tasks.update(id, { completed: !task.completed });
      toast.success(task.completed ? 'Task reopened' : 'Task completed');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async () => {
    try {
      await tasks.remove(id);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <Link to="/tasks" className="d-inline-flex align-items-center gap-1 mb-3">
        <ArrowLeft size={16} aria-hidden="true" /> Tasks
      </Link>
      <article className="tm-card p-4 p-md-5" aria-labelledby="task-title-heading">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className={`h3 mb-2 ${task.completed ? 'text-decoration-line-through text-secondary' : ''}`} id="task-title-heading">
              {task.title}
            </h1>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <PriorityBadge priority={task.priority} />
              <DueBadge info={dueInfo(task.dueDate, { completed: task.completed })} />
              <span className="small text-secondary">· {task.completed ? `Completed ${formatDate(task.completedAt)}` : 'Open'}</span>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 align-self-start">
            <Button variant={task.completed ? 'outline-secondary' : 'success'} onClick={toggle}>
              {task.completed ? <RotateCcw size={15} className="me-1" aria-hidden="true" /> : <CheckCircle2 size={15} className="me-1" aria-hidden="true" />}
              {task.completed ? 'Reopen' : 'Mark complete'}
            </Button>
            <Button variant="outline-secondary" onClick={() => setModal('edit')}>
              <Pencil size={15} className="me-1" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="outline-danger" onClick={() => setModal('delete')}>
              <Trash2 size={15} className="me-1" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        <dl className="row mb-0">
          <dt className="col-sm-3 text-secondary fw-medium">Client</dt>
          <dd className="col-sm-9">{task.client ? <Link to={`/client/${task.client._id}`}>{task.client.name}</Link> : <span className="text-secondary">None</span>}</dd>
          <dt className="col-sm-3 text-secondary fw-medium">Due</dt>
          <dd className="col-sm-9">{formatDate(task.dueDate)}</dd>
          <dt className="col-sm-3 text-secondary fw-medium">Description</dt>
          <dd className="col-sm-9 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {task.description || <span className="text-secondary">No description</span>}
          </dd>
        </dl>
      </article>

      <TaskFormModal
        show={modal === 'edit'}
        task={task}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          reload();
        }}
      />
      <ConfirmModal show={modal === 'delete'} title="Delete this task?" onConfirm={remove} onClose={() => setModal(null)}>
        “{task.title}” will be permanently removed.
      </ConfirmModal>
    </>
  );
}
