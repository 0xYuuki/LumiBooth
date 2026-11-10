import { layouts } from '../context/photoboothSession';

const TemplateManager = () => {
  return (
    <div>
      <h1 className="page-title">Available Templates</h1>
      <div className="stats-grid">
        {layouts.map(({ id, name, count }) => (
          <div className="card" key={id}>
            <h2 className="card-header">{name}</h2>
            <p>{count} {count === 1 ? 'photo' : 'photos'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateManager;
