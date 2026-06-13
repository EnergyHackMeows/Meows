"""
Fills snow_depth nulls with 0 and splits train.parquet into:
  - train_final.parquet : 2021-01-01 → 2026-03-12
  - test.parquet        : 2026-03-13 → 2026-06-12
"""
import pandas as pd
from pathlib import Path

D = Path(__file__).parent

df = pd.read_parquet(D / "train.parquet")

df["snow_depth"] = df["snow_depth"].fillna(0.0)

TEST_START = pd.Timestamp("2026-03-13")

train = df[df["timestamp"] < TEST_START].reset_index(drop=True)
test  = df[df["timestamp"] >= TEST_START].reset_index(drop=True)

train.to_parquet(D / "train_final.parquet", index=False)
test.to_parquet(D / "test.parquet", index=False)

print(f"train_final.parquet : {len(train):,} rows  ({train.timestamp.min()} → {train.timestamp.max()})")
print(f"test.parquet        : {len(test):,} rows  ({test.timestamp.min()} → {test.timestamp.max()})")
print(f"Zones per split     : train={train.groupby('zone').size().iloc[0]}  test={test.groupby('zone').size().iloc[0]}")
print(f"snow_depth nulls    : {df['snow_depth'].isnull().sum()}")
