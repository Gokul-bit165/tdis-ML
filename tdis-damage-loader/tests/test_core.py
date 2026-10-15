"""Algorithms: representative point, H3 assignment, aggregation. No database."""
import h3
import numpy as np
import shapely
from shapely.geometry import Polygon

from damage_core import (NOT_ASSESSED, RESOLUTIONS, aggregate, cell_ids, disk_order, dominant_class, envelope,
                         hexagons, inside_texas, representative_points)


def random_points(n=4000, seed=1):
    rng = np.random.default_rng(seed)
    return rng.uniform(29.6, 29.9, n), rng.uniform(-95.6, -95.2, n)


def test_representative_point_is_inside_an_l_shaped_building():
    l_shape = Polygon([(0, 0), (10, 0), (10, 1), (1, 1), (1, 10), (0, 10)])
    assert not l_shape.contains(l_shape.centroid)  # why a centroid is not used
    point = representative_points(np.array([l_shape], dtype=object))[0]
    assert l_shape.contains(point)


def test_every_building_is_counted_exactly_once_at_every_resolution():
    lat, lng = random_points()
    cls = np.random.default_rng(2).integers(-1, 5, len(lat))
    cells = aggregate(lat, lng, cls)
    assert tuple(sorted(cells["res"].unique())) == RESOLUTIONS
    for res, group in cells.groupby("res"):
        assert group["n"].sum() == len(lat)
        assert group["na"].sum() == (cls != NOT_ASSESSED).sum()
        for k in range(5):
            assert group[f"c{k}"].sum() == (cls == k).sum()
        assert (group[[f"c{k}" for k in range(5)]].sum(axis=1) == group["na"]).all()
        assert (group["na"] <= group["n"]).all() and (group["n"] > 0).all()
        assert group["h3"].is_unique
        assert all(h3.get_resolution(c) == res for c in group["h3"])


def test_cells_are_indexed_directly_not_rolled_up_from_children():
    lat, lng = random_points(20000, seed=3)
    direct = cell_ids(lat, lng, 6)
    rolled_up = np.array([h3.cell_to_parent(c, 6) for c in cell_ids(lat, lng, 10)], dtype=object)
    # The two methods disagree for buildings near a hexagon edge; the loader must use the direct one.
    assert (direct != rolled_up).any()
    cells = aggregate(lat, lng, np.zeros(len(lat), dtype=int))
    res6 = cells[cells["res"] == 6].set_index("h3")["n"]
    expected = dict(zip(*np.unique(direct, return_counts=True)))
    assert res6.to_dict() == expected


def test_each_building_point_is_inside_the_hexagon_that_counts_it():
    lat, lng = random_points(500, seed=4)
    cells = cell_ids(lat, lng, 9)
    polys = hexagons(cells)
    inside = shapely.dwithin(polys, shapely.points(lng, lat), 1e-7)
    assert inside.all()
    assert all(shapely.get_srid(p) == 4326 for p in polys[:5])


def test_dominant_class_ties_go_to_the_more_severe_class():
    counts = np.array([[5, 0, 0, 0, 5],   # tie between Undamaged and Total Structural Collapse
                       [9, 1, 0, 0, 0],
                       [2, 3, 3, 0, 0],   # tie between classes 1 and 2
                       [0, 0, 0, 0, 0]])  # nothing assessed
    assert dominant_class(counts, counts.sum(axis=1)).tolist() == [4, 0, 2, NOT_ASSESSED]


def test_unassessed_buildings_count_as_buildings_but_not_as_any_class():
    lat = np.array([29.75, 29.75001, 29.75002])
    lng = np.array([-95.36, -95.36001, -95.36002])
    cells = aggregate(lat, lng, np.array([NOT_ASSESSED, NOT_ASSESSED, NOT_ASSESSED]))
    assert (cells["n"].groupby(cells["res"]).sum() == 3).all()
    assert (cells["na"] == 0).all() and (cells["dom"] == NOT_ASSESSED).all()
    assert (cells[[f"c{k}" for k in range(5)]].to_numpy() == 0).all()


def test_cell_point_is_the_centre_of_mass_of_its_buildings():
    lat = np.array([29.7500, 29.7502])
    lng = np.array([-95.3600, -95.3604])
    coarse = aggregate(lat, lng, np.array([0, 4]))
    row = coarse[coarse["res"] == 4].iloc[0]
    assert row["n"] == 2
    assert abs(row["lat"] - 29.7501) < 1e-9 and abs(row["lng"] - -95.3602) < 1e-9


def test_disk_order_groups_neighbours():
    lat, lng = random_points(2000, seed=5)
    order = disk_order(lat, lng)
    assert sorted(order.tolist()) == list(range(2000))
    finest = cell_ids(lat, lng, 10)[order]
    assert (finest[:-1] <= finest[1:]).all()


def test_texas_envelope_and_degenerate_extent():
    assert inside_texas(-95.8, 29.5, -95.0, 30.1)
    assert not inside_texas(-120.0, 34.0, -118.0, 35.0)       # California
    assert not inside_texas(250000.0, 3200000.0, 260000.0, 3300000.0)  # projected metres
    box = envelope(-95.0, 29.0, -95.0, 29.0)
    assert box.area > 0 and shapely.get_srid(box) == 4326
