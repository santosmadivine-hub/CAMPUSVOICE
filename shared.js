.page-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.page-subtitle {
  font-size: 12.5px;
  font-style: italic;
  color: #6b7280;
  line-height: 1.3;
}

@media (max-width: 768px) {
  .page-subtitle {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
