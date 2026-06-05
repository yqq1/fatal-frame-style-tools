import { BookOpenText, ChevronRight, Film, Play, Sparkles } from 'lucide-react';
import { videos } from '../data/videos';
import { blogPosts } from '../lib/blogPosts';

type ActivityRailProps = {
  onOpenBlog: () => void;
  onOpenVideo: () => void;
};

function ActivityRail({ onOpenBlog, onOpenVideo }: ActivityRailProps) {
  const latestPost = blogPosts[0];
  const featuredVideo = videos[0];

  return (
    <aside className="activity-rail" aria-label="内容预览">
      <div className="section-heading">
        <div>
          <p className="eyebrow">study archive</p>
          <h2>今日入口</h2>
        </div>
        <Sparkles size={17} aria-hidden="true" />
      </div>

      {latestPost ? (
        <button className="activity-link note-snapshot" data-motion="item" type="button" onClick={onOpenBlog}>
          <span className="activity-kicker">
            <BookOpenText size={15} aria-hidden="true" />
            最新笔记
          </span>
          <strong>{latestPost.title}</strong>
          <em>{latestPost.excerpt}</em>
          <small>
            {latestPost.date} / {latestPost.readingTime}
          </small>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <div className="activity-empty">暂无笔记</div>
      )}

      {featuredVideo ? (
        <button className="activity-link video-snapshot" data-motion="item" type="button" onClick={onOpenVideo}>
          <img src={featuredVideo.thumbnail} alt="" />
          <span className="play-chip">
            <Play size={14} aria-hidden="true" />
            视频
          </span>
          <strong>{featuredVideo.title}</strong>
          <em>{featuredVideo.description}</em>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <div className="activity-empty">暂无视频</div>
      )}

      <div className="rail-metrics" aria-label="内容统计">
        <span>
          <strong>{blogPosts.length}</strong>
          笔记
        </span>
        <span>
          <strong>{videos.length}</strong>
          视频
        </span>
        <span>
          <Film size={15} aria-hidden="true" />
          本地
        </span>
      </div>
    </aside>
  );
}

export default ActivityRail;
