#!/usr/bin/env python3
"""
Average Open-Meteo hourly weather across 6 grid points per German TSO zone.

Reads germany_24points_*.csv files, skips the location metadata block,
groups by timestamp and transmission zone, and writes zone-level means.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

WORKSPACE = Path(__file__).resolve().parent

INPUT_FILES = sorted(WORKSPACE.glob("germany_24points_*.csv"))

OUTPUT_FILE = WORKSPACE / "germany_hourly_zone_averages.csv"

DATA_HEADER_PREFIX = "location_id,time,"

ZONE_RANGES: list[tuple[int, int, str]] = [
    (0, 5, "50Hertz"),
    (6, 11, "TenneT"),
    (12, 17, "Amprion"),
    (18, 23, "TransnetBW"),
]

ZONE_ORDER = ["50Hertz", "TenneT", "Amprion", "TransnetBW"]


def location_to_zone(location_id: int) -> str:
    for start, end, zone in ZONE_RANGES:
        if start <= location_id <= end:
            return zone
    raise ValueError(f"Unexpected location_id: {location_id}")


def find_data_header_line(path: Path) -> int:
    """Return 0-based line index of the hourly data header row."""
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle):
            if line.startswith(DATA_HEADER_PREFIX):
                return line_number
    raise ValueError(f"Could not find hourly data header in {path.name}")


def load_hourly_data(path: Path) -> pd.DataFrame:
    header_line = find_data_header_line(path)
    df = pd.read_csv(
        path,
        skiprows=range(header_line),
        encoding="utf-8",
    )
    df["location_id"] = df["location_id"].astype(int)
    df["Zone"] = df["location_id"].map(location_to_zone)
    return df


def average_by_zone(df: pd.DataFrame) -> pd.DataFrame:
    weather_columns = [
        column
        for column in df.columns
        if column not in {"location_id", "time", "Zone"}
    ]

    averaged = (
        df.groupby(["time", "Zone"], as_index=False)[weather_columns]
        .mean(numeric_only=True)
    )

    averaged["Zone"] = pd.Categorical(
        averaged["Zone"],
        categories=ZONE_ORDER,
        ordered=True,
    )
    averaged = averaged.sort_values(["time", "Zone"]).reset_index(drop=True)
    averaged["Zone"] = averaged["Zone"].astype(str)

    return averaged[["time", "Zone", *weather_columns]]


def main() -> None:
    if not INPUT_FILES:
        raise FileNotFoundError(
            "No input files matching germany_24points_*.csv found."
        )

    frames: list[pd.DataFrame] = []
    for path in INPUT_FILES:
        print(f"Processing {path.name} ...")
        hourly = load_hourly_data(path)
        zone_averages = average_by_zone(hourly)
        frames.append(zone_averages)
        print(f"  -> {len(zone_averages):,} zone-hour rows")

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values(["time", "Zone"]).reset_index(drop=True)

    combined.to_csv(OUTPUT_FILE, index=False)
    print(f"\nWrote {len(combined):,} rows to {OUTPUT_FILE.name}")


if __name__ == "__main__":
    main()
