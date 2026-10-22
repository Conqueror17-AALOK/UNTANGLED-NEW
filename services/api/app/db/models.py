import datetime
import json
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from services.api.app.db.database import Base


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class JobModel(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, index=True)
    status = Column(String(20), default="queued")  # queued, running, done, failed
    stage = Column(String(30), default="perception")
    progress = Column(Float, default=0.0)
    pages = Column(Integer, default=1)
    
    pdf_path = Column(String(500), nullable=False)
    xlsx_path = Column(String(500), nullable=False)
    
    # Store summary stats as JSON string
    summary_json = Column(Text, default='{"resolved": 0, "needs_review": 0, "rejected": 0}')
    error_json = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    tags = relationship("TagModel", back_populates="job", cascade="all, delete-orphan")
    corrections = relationship("CorrectionModel", back_populates="job", cascade="all, delete-orphan")

    @property
    def summary(self):
        try:
            return json.loads(self.summary_json) if self.summary_json else {}
        except Exception:
            return {}

    @summary.setter
    def summary(self, val):
        self.summary_json = json.dumps(val)

    @property
    def error(self):
        try:
            return json.loads(self.error_json) if self.error_json else None
        except Exception:
            return None

    @error.setter
    def error(self, val):
        self.error_json = json.dumps(val) if val is not None else None


class TagModel(Base):
    __tablename__ = "tags"

    id = Column(String(64), primary_key=True, index=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    page = Column(Integer, default=1)
    raw_text = Column(String(100), nullable=False)
    normalized_tag = Column(String(100), nullable=False, index=True)
    type = Column(String(100), default="Instrument")
    category = Column(String(50), default="instrument")  # instrument, equipment, valve
    
    bbox_json = Column(Text, default="[0,0,0,0]")
    confidence = Column(Float, default=1.0)
    conf_breakdown_json = Column(Text, default='{"ocr":1.0,"symbol":1.0,"io_match":1.0,"grammar":1.0,"llm":1.0}')
    
    status = Column(String(20), default="resolved")  # resolved, needs_review, rejected
    io_match_json = Column(Text, default='{"matched":false}')
    reasoning = Column(Text, default="")
    source = Column(String(20), default="auto")  # auto, llm, human

    job = relationship("JobModel", back_populates="tags")

    @property
    def bbox(self):
        try:
            return json.loads(self.bbox_json) if self.bbox_json else [0, 0, 0, 0]
        except Exception:
            return [0, 0, 0, 0]

    @bbox.setter
    def bbox(self, val):
        self.bbox_json = json.dumps(val)

    @property
    def conf_breakdown(self):
        try:
            return json.loads(self.conf_breakdown_json) if self.conf_breakdown_json else {}
        except Exception:
            return {}

    @conf_breakdown.setter
    def conf_breakdown(self, val):
        self.conf_breakdown_json = json.dumps(val)

    @property
    def io_match(self):
        try:
            return json.loads(self.io_match_json) if self.io_match_json else {"matched": False}
        except Exception:
            return {"matched": False}

    @io_match.setter
    def io_match(self, val):
        self.io_match_json = json.dumps(val)


class CorrectionModel(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    tag_id = Column(String(64), nullable=False)
    previous_val = Column(String(100), nullable=False)
    new_val = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=utc_now)

    job = relationship("JobModel", back_populates="corrections")
